import { RowDataPacket } from 'mysql2/promise';
import { StatusCodes } from 'http-status-codes';
import createHttpError from 'http-errors';
import { executeQuery } from './database.service';
import dataVersionsService from './data-versions.service';
import equipmentService from './equipment.service';
import notificationService from './notification.service';
import type {
  CreateReservationDto,
  UpdateReservationDto,
  AddReservationEquipmentDto,
} from '../schemas/reservations.schemas';
import type { ReservationState } from '../types';

// ---- Helpers ----

function canViewerEdit(state: ReservationState): boolean {
  return ['draft', 'waiting_for_approval'].includes(state);
}

// ---- Availability ----

async function checkAvailability(
  equipmentId: number,
  pickupDatetime: string,
  returnDatetime: string,
  quantity: number,
  excludeReservationId?: number,
): Promise<void> {
  const [equipment] = await executeQuery<RowDataPacket[]>(
    'SELECT quantity FROM equipment WHERE equipment_id = ?',
    [equipmentId],
  );
  if (!equipment) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Equipment not found');
  }

  const totalQty = equipment['quantity'];
  let query = `SELECT COALESCE(SUM(re.quantity), 0) AS reserved_qty
               FROM reservation_equipment re
               JOIN reservations r ON re.reservation_id = r.reservation_id
               WHERE re.equipment_id = ?
                 AND r.state IN (?, ?, ?, ?)
                 AND r.pickup_datetime < ?
                 AND r.return_datetime > ?`;
  const params: unknown[] = [
    equipmentId,
    'reserved',
    'waiting_for_pickup',
    'picked_up',
    'waiting_for_return',
    returnDatetime,
    pickupDatetime,
  ];

  if (excludeReservationId !== undefined) {
    query += ' AND r.reservation_id != ?';
    params.push(excludeReservationId);
  }

  const [row] = await executeQuery<RowDataPacket[]>(query, params);
  let reservedQty = Number(row?.['reserved_qty'] ?? 0);

  // Check if this equipment is an attachment of any parent equipment reserved in overlapping reservations
  const parentEquipmentId = await executeQuery<RowDataPacket[]>(
    'SELECT parent_equipment_id FROM equipment WHERE equipment_id = ?',
    [equipmentId],
  );
  const parentId = parentEquipmentId[0]?.['parent_equipment_id'];
  if (parentId) {
    let parentQuery = `SELECT COALESCE(SUM(re.quantity), 0) AS parent_reserved_qty
                       FROM reservation_equipment re
                       JOIN reservations r ON re.reservation_id = r.reservation_id
                       WHERE re.equipment_id = ?
                         AND r.state IN (?, ?, ?, ?)
                         AND r.pickup_datetime < ?
                         AND r.return_datetime > ?`;
    const parentParams: unknown[] = [
      parentId, 'reserved', 'waiting_for_pickup', 'picked_up', 'waiting_for_return',
      returnDatetime, pickupDatetime,
    ];
    if (excludeReservationId !== undefined) {
      parentQuery += ' AND r.reservation_id != ?';
      parentParams.push(excludeReservationId);
    }
    const [parentRow] = await executeQuery<RowDataPacket[]>(parentQuery, parentParams);
    const parentReservedQty = Number(parentRow?.['parent_reserved_qty'] ?? 0);
    reservedQty += parentReservedQty;
  }

  const availableQty = totalQty - reservedQty;

  if (availableQty < quantity) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      `Insufficient available quantity for equipment ${equipmentId}. ` +
        `Requested: ${quantity}, Available: ${Math.max(0, availableQty)}`,
    );
  }
}

// ---- Table creation ----

async function ensureTables(): Promise<void> {
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS reservations (
      reservation_id INT AUTO_INCREMENT PRIMARY KEY,
      class_id INT NOT NULL,
      receiver_person_id INT NOT NULL,
      pickup_datetime DATETIME NOT NULL,
      return_datetime DATETIME NOT NULL,
      state ENUM('draft','waiting_for_approval','reserved','waiting_for_pickup','picked_up','waiting_for_return','returned') NOT NULL DEFAULT 'draft',
      notes TEXT,
      created_by INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (class_id) REFERENCES classes(class_id),
      FOREIGN KEY (receiver_person_id) REFERENCES persons(person_id),
      FOREIGN KEY (created_by) REFERENCES accounts(account_id)
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS reservation_equipment (
      reservation_equipment_id INT AUTO_INCREMENT PRIMARY KEY,
      reservation_id INT NOT NULL,
      equipment_id INT NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE,
      FOREIGN KEY (equipment_id) REFERENCES equipment(equipment_id),
      UNIQUE KEY (reservation_id, equipment_id)
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS reservation_excluded_attachments (
      reservation_equipment_id INT NOT NULL,
      attachment_id INT NOT NULL,
      PRIMARY KEY (reservation_equipment_id, attachment_id),
      FOREIGN KEY (reservation_equipment_id) REFERENCES reservation_equipment(reservation_equipment_id) ON DELETE CASCADE,
      FOREIGN KEY (attachment_id) REFERENCES equipment(equipment_id) ON DELETE CASCADE
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS reservation_reviewers (
      reservation_reviewer_id INT AUTO_INCREMENT PRIMARY KEY,
      reservation_id INT NOT NULL,
      account_id INT NOT NULL,
      is_default TINYINT NOT NULL DEFAULT 0,
      status ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
      reviewed_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id),
      UNIQUE KEY (reservation_id, account_id)
    )`,
  );
  await executeQuery(
    `CREATE TABLE IF NOT EXISTS reservation_history (
      reservation_history_id INT AUTO_INCREMENT PRIMARY KEY,
      reservation_id INT NOT NULL,
      account_id INT NOT NULL,
      action VARCHAR(50) NOT NULL,
      details JSON NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (reservation_id) REFERENCES reservations(reservation_id) ON DELETE CASCADE,
      FOREIGN KEY (account_id) REFERENCES accounts(account_id)
    )`,
  );

  // Migrate existing table from receiver_account_id to receiver_person_id
  await executeQuery(`ALTER TABLE reservations DROP FOREIGN KEY reservations_ibfk_2`).catch(() => {});
  await executeQuery(
    `ALTER TABLE reservations
     CHANGE COLUMN receiver_account_id receiver_person_id INT NOT NULL`,
  ).catch(() => {});
  await executeQuery(
    `ALTER TABLE reservations
     ADD FOREIGN KEY (receiver_person_id) REFERENCES persons(person_id)`,
  ).catch(() => {});

  // Update state ENUM if upgrading an existing table
  await executeQuery(
    `ALTER TABLE reservations
     MODIFY COLUMN state ENUM('draft','waiting_for_approval','reserved','waiting_for_pickup','picked_up','waiting_for_return','returned')
     NOT NULL DEFAULT 'draft'`,
  ).catch(() => {});
}

// ---- History logging ----

async function logHistory(
  reservationId: number,
  accountId: number,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await executeQuery(
    'INSERT INTO reservation_history (reservation_id, account_id, action, details) VALUES (?, ?, ?, ?)',
    [reservationId, accountId, action, details ? JSON.stringify(details) : null],
  );
}

// ---- CRUD ----

async function createReservation(
  data: CreateReservationDto,
  createdBy: number,
): Promise<number> {
  if (new Date(data.return_datetime) <= new Date(data.pickup_datetime)) {
    throw createHttpError(
      StatusCodes.BAD_REQUEST,
      'return_datetime must be after pickup_datetime',
    );
  }

  // Validate receiver is a teacher in the class
  const receiverCheck = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM person_class
     WHERE person_id = ? AND class_id = ? AND type = 'teacher'`,
    [data.receiver_person_id, data.class_id],
  );
  if (receiverCheck.length === 0) {
    throw createHttpError(
      StatusCodes.BAD_REQUEST,
      'Receiver is not a teacher in the specified class',
    );
  }

  const result = await executeQuery<RowDataPacket[]>(
    `INSERT INTO reservations (class_id, receiver_person_id, pickup_datetime, return_datetime, notes, created_by, group_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      data.class_id,
      data.receiver_person_id,
      data.pickup_datetime,
      data.return_datetime,
      data.notes ?? null,
      createdBy,
      data.group_id ?? null,
    ],
  );
  const reservationId = (result as any).insertId;

  await logHistory(reservationId, createdBy, 'created');
  dataVersionsService.touchReservations().catch(() => {});

  return reservationId;
}

async function getReservations(
  userId: number,
  filters: {
    class_id: number | undefined;
    group_id: number | undefined;
    state: ReservationState | undefined;
    role: 'created' | 'receiving' | 'reviewer' | 'organizer' | undefined;
    from_date: string | undefined;
    to_date: string | undefined;
  },
): Promise<RowDataPacket[]> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.class_id !== undefined) {
    conditions.push('r.class_id = ?');
    params.push(filters.class_id);
  }
  if (filters.group_id !== undefined) {
    conditions.push('r.group_id = ?');
    params.push(filters.group_id);

    // Non-organizers should only see reservations for classes they belong to
    if (filters.class_id === undefined && filters.role !== 'organizer') {
      const [isOrganizer] = await executeQuery<RowDataPacket[]>(
        'SELECT 1 FROM equipment_group_members WHERE group_id = ? AND account_id = ? AND access_level = \'organizer\' LIMIT 1',
        [filters.group_id, userId],
      );
      if (!isOrganizer) {
        const userRoles = await executeQuery<RowDataPacket[]>(
          'SELECT DISTINCT class_id FROM roles WHERE account_id = ? AND class_id IS NOT NULL',
          [userId],
        );
        const classIds = userRoles.map((r: RowDataPacket) => r['class_id']);
        if (classIds.length > 0) {
          conditions.push(`r.class_id IN (${classIds.map(() => '?').join(',')})`);
          params.push(...classIds);
        }
      }
    }
  }
  if (filters.state !== undefined) {
    conditions.push('r.state = ?');
    params.push(filters.state);
  }
  if (filters.from_date !== undefined) {
    conditions.push('r.pickup_datetime >= ?');
    params.push(filters.from_date);
  }
  if (filters.to_date !== undefined) {
    conditions.push('r.return_datetime <= ?');
    params.push(filters.to_date);
  }

  if (filters.role === 'created') {
    conditions.push('r.created_by = ?');
    params.push(userId);
  } else if (filters.role === 'receiving') {
    conditions.push(
      'r.receiver_person_id = (SELECT person_id FROM accounts WHERE account_id = ?)',
    );
    params.push(userId);
  } else if (filters.role === 'reviewer') {
    conditions.push(
      'EXISTS (SELECT 1 FROM reservation_reviewers rr WHERE rr.reservation_id = r.reservation_id AND rr.account_id = ?)',
    );
    params.push(userId);
  } else if (filters.role === 'organizer') {
    conditions.push(
      `EXISTS (
        SELECT 1 FROM reservation_equipment re2
        JOIN equipment e2 ON re2.equipment_id = e2.equipment_id
        JOIN equipment_group_members egm ON egm.group_id = e2.group_id AND egm.account_id = ? AND egm.access_level = 'organizer'
        WHERE re2.reservation_id = r.reservation_id
      )`,
    );
    params.push(userId);
  } else {
    // No role filter: show reservations user is involved in
    conditions.push(
      `(r.created_by = ? OR r.receiver_person_id = (SELECT person_id FROM accounts WHERE account_id = ?) OR EXISTS (
        SELECT 1 FROM reservation_reviewers rr WHERE rr.reservation_id = r.reservation_id AND rr.account_id = ?
      ) OR EXISTS (
        SELECT 1 FROM reservation_equipment re2
        JOIN equipment e2 ON re2.equipment_id = e2.equipment_id
        JOIN equipment_group_members egm ON egm.group_id = e2.group_id AND egm.account_id = ?
        WHERE re2.reservation_id = r.reservation_id
      ))`,
    );
    params.push(userId, userId, userId, userId);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  return executeQuery<RowDataPacket[]>(
    `SELECT r.*, c.class_name,
            creator.username AS creator_name,
            creator.real_name AS creator_real_name,
            receiver.person_name AS receiver_name
     FROM reservations r
     LEFT JOIN classes c ON r.class_id = c.class_id
     LEFT JOIN accounts creator ON r.created_by = creator.account_id
     LEFT JOIN persons receiver ON r.receiver_person_id = receiver.person_id
     ${where}
     ORDER BY r.pickup_datetime DESC`,
    params,
  );
}

async function getReservationById(
  reservationId: number,
  userId?: number,
): Promise<RowDataPacket | undefined> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    `SELECT r.reservation_id, r.class_id, r.group_id, r.receiver_person_id,
            r.pickup_datetime, r.return_datetime, r.state, r.notes,
            r.created_by,
            c.class_name,
            creator.real_name AS creator_real_name,
            receiver.person_name AS receiver_real_name
     FROM reservations r
     LEFT JOIN classes c ON r.class_id = c.class_id
     LEFT JOIN accounts creator ON r.created_by = creator.account_id
     LEFT JOIN persons receiver ON r.receiver_person_id = receiver.person_id
     WHERE r.reservation_id = ?`,
    [reservationId],
  );
  if (!reservation) return undefined;

  const items = await executeQuery<RowDataPacket[]>(
    `SELECT re.reservation_equipment_id, re.equipment_id, re.quantity,
            e.name AS equipment_name, e.description, e.photo,
            eg.group_id, eg.group_name
     FROM reservation_equipment re
     JOIN equipment e ON re.equipment_id = e.equipment_id
     JOIN equipment_groups eg ON e.group_id = eg.group_id
     WHERE re.reservation_id = ?
     ORDER BY e.name`,
    [reservationId],
  );

  // For each item, get excluded attachments and all possible attachments
  for (const item of items) {
    const excluded = await executeQuery<RowDataPacket[]>(
      `SELECT rea.attachment_id, e.name AS attachment_name
       FROM reservation_excluded_attachments rea
       JOIN equipment e ON rea.attachment_id = e.equipment_id
       WHERE rea.reservation_equipment_id = ?`,
      [item['reservation_equipment_id']],
    );
    item['excluded_attachments'] = excluded;

    // Determine which excluded attachments are reserved in another overlapping reservation
    const blocked = await executeQuery<RowDataPacket[]>(
      `SELECT DISTINCT rea.attachment_id
       FROM reservation_excluded_attachments rea
       LEFT JOIN equipment e ON rea.attachment_id = e.equipment_id
       LEFT JOIN reservation_equipment re2 ON (
         re2.equipment_id = rea.attachment_id
         OR (e.parent_equipment_id IS NOT NULL AND re2.equipment_id = e.parent_equipment_id)
       )
       JOIN reservations r ON re2.reservation_id = r.reservation_id
       WHERE rea.reservation_equipment_id = ?
         AND r.reservation_id != ?
         AND r.state IN (?, ?, ?, ?)
         AND r.pickup_datetime < ?
         AND r.return_datetime > ?`,
      [item['reservation_equipment_id'], reservation['reservation_id'],
       'reserved', 'waiting_for_pickup', 'picked_up', 'waiting_for_return',
       reservation['return_datetime'], reservation['pickup_datetime']],
    );
    item['blocked_attachment_ids'] = blocked.map((b: RowDataPacket) => b['attachment_id']);

    const allAttachments = await equipmentService.getItemAttachments(item['equipment_id']);
    item['all_attachments'] = allAttachments;
  }
  reservation['items'] = items;

  const reviewers = await executeQuery<RowDataPacket[]>(
    `SELECT rr.reservation_reviewer_id, rr.account_id, rr.is_default, rr.status, rr.reviewed_at,
            a.username, a.real_name
     FROM reservation_reviewers rr
     JOIN accounts a ON rr.account_id = a.account_id
     WHERE rr.reservation_id = ?
     ORDER BY rr.is_default DESC, rr.created_at`,
    [reservationId],
  );
  reservation['reviewers'] = reviewers;
  reservation['is_current_user_reviewer'] = userId
    ? reviewers.some((r: RowDataPacket) => r['account_id'] === userId && r['status'] === 'pending')
    : false;

  const history = await executeQuery<RowDataPacket[]>(
    `SELECT rh.*, a.username, a.real_name
     FROM reservation_history rh
     JOIN accounts a ON rh.account_id = a.account_id
     WHERE rh.reservation_id = ?
     ORDER BY rh.created_at`,
    [reservationId],
  );
  reservation['history'] = history;

  // Determine rejection_reason — only if the latest history event is 'rejected'
  const latestEntry = history.length > 0 ? history[history.length - 1] : null;
  if (latestEntry && latestEntry['action'] === 'rejected' && latestEntry['details']) {
    const details = typeof latestEntry['details'] === 'string'
      ? JSON.parse(latestEntry['details'] as string)
      : latestEntry['details'];
    reservation['rejection_reason'] = (details as Record<string, unknown>)['notes'] ?? null;
  } else {
    reservation['rejection_reason'] = null;
  }

  return reservation;
}

async function updateReservation(
  reservationId: number,
  data: UpdateReservationDto,
  userId: number,
): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT reservation_id, class_id, receiver_person_id, pickup_datetime, return_datetime, state, notes, created_by, created_at, updated_at FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }

  const isCreator = reservation['created_by'] === userId;
  const isReceiver =
    reservation['receiver_person_id'] !== null &&
    (await getAccountIdsForPerson(reservation['receiver_person_id'])).includes(userId);
  const isViewer = isCreator || isReceiver;

  if (isViewer && !canViewerEdit(reservation['state'])) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Cannot edit reservation in its current state',
    );
  }

  const sets: string[] = [];
  const values: unknown[] = [];
  if (data.pickup_datetime !== undefined) {
    sets.push('pickup_datetime = ?');
    values.push(data.pickup_datetime);
  }
  if (data.return_datetime !== undefined) {
    sets.push('return_datetime = ?');
    values.push(data.return_datetime);
  }
  if (data.notes !== undefined) {
    sets.push('notes = ?');
    values.push(data.notes);
  }

  if (sets.length === 0) return;

  values.push(reservationId);
  await executeQuery(
    `UPDATE reservations SET ${sets.join(', ')} WHERE reservation_id = ?`,
    values,
  );

  const isOrganizer = await isUserOrganizerOfReservation(userId, reservationId);

  if (isViewer && reservation['state'] !== 'draft' && reservation['state'] !== 'waiting_for_approval') {
    // Viewer edit resets approval
    await executeQuery(
      'UPDATE reservations SET state = ? WHERE reservation_id = ?',
      ['waiting_for_approval', reservationId],
    );
    await executeQuery(
      'UPDATE reservation_reviewers SET status = ?, reviewed_at = NULL WHERE reservation_id = ?',
      ['pending', reservationId],
    );
    const reviewerIds = await getReviewerAccountIds(reservationId);
    await logHistory(reservationId, userId, 'edited', { reset_approval: true });
    await notificationService.notifyReservationEditedByViewer(reservationId, reviewerIds);
  } else if (isOrganizer) {
    await logHistory(reservationId, userId, 'edited');
    const receiverAccountIds = await getAccountIdsForPerson(reservation['receiver_person_id']);
    const allRecipients = [...new Set([...receiverAccountIds, reservation['created_by']])];
    for (const accountId of allRecipients) {
      await notificationService.notifyReservationEditedByOrganizer(reservationId, accountId);
    }
  } else {
    await logHistory(reservationId, userId, 'edited');
  }

  dataVersionsService.touchReservation(reservationId).catch(() => {});
  dataVersionsService.touchReservations().catch(() => {});
}

async function deleteReservation(reservationId: number, userId: number): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT reservation_id, class_id, receiver_person_id, pickup_datetime, return_datetime, state, notes, created_by, created_at, updated_at FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }
  const isOrg = await isUserOrganizerOfReservation(userId, reservationId);
  if (!isOrg) {
    if (reservation['state'] !== 'draft' && reservation['state'] !== 'waiting_for_approval') {
      throw createHttpError(
        StatusCodes.CONFLICT,
        'Can only delete reservations in draft or waiting_for_approval state',
      );
    }
    if (reservation['created_by'] !== userId) {
      throw createHttpError(StatusCodes.FORBIDDEN, 'Not authorized to delete this reservation');
    }
  }

  const receiverAccountIds = await getAccountIdsForPerson(reservation['receiver_person_id']);
  const allRecipients = [...new Set([...receiverAccountIds, reservation['created_by']])];
  await notificationService.notifyReservationDeleted(reservationId, allRecipients);

  await executeQuery('DELETE FROM reservations WHERE reservation_id = ?', [reservationId]);
  dataVersionsService.touchReservations().catch(() => {});
}

// ---- Equipment management ----

async function addEquipment(
  reservationId: number,
  data: AddReservationEquipmentDto,
  userId: number,
): Promise<number> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT state, pickup_datetime, return_datetime FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }
  if (!canViewerEdit(reservation['state'])) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Cannot modify equipment in the current reservation state',
    );
  }

  // Check user has access to this equipment's group
  const groupId = await equipmentService.getItemGroupId(data.equipment_id);
  if (!groupId) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Equipment not found');
  }
  const hasAccess = await equipmentService.hasViewAccess(userId, groupId);
  if (!hasAccess) {
    throw createHttpError(StatusCodes.FORBIDDEN, 'No access to this equipment');
  }

  // Check all items in the reservation belong to the same group
  const existing = await executeQuery<RowDataPacket[]>(
    `SELECT DISTINCT e.group_id FROM reservation_equipment re
     JOIN equipment e ON re.equipment_id = e.equipment_id
     WHERE re.reservation_id = ? AND e.group_id != ?`,
    [reservationId, groupId],
  );
  if (existing.length > 0 && existing[0]) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'All equipment in a reservation must belong to the same group',
    );
  }

  // Check equipment is not already in the reservation
  const existingEquipment = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM reservation_equipment WHERE reservation_id = ? AND equipment_id = ?',
    [reservationId, data.equipment_id],
  );
  if (existingEquipment.length > 0) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Equipment is already in the reservation',
    );
  }

  // Check if equipment is an attachment of any equipment already in the reservation
  const parentInReservation = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM reservation_equipment re
     WHERE re.reservation_id = ?
       AND re.equipment_id = (SELECT parent_equipment_id FROM equipment WHERE equipment_id = ?)`,
    [reservationId, data.equipment_id],
  );
  if (parentInReservation.length > 0) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Equipment is already included as an attachment of another item in the reservation',
    );
  }

  // Check if any attachments of this equipment are already in the reservation
  const childInReservation = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM reservation_equipment re
     WHERE re.reservation_id = ? AND re.equipment_id IN (
       SELECT equipment_id FROM equipment WHERE parent_equipment_id = ?
     )`,
    [reservationId, data.equipment_id],
  );
  if (childInReservation.length > 0) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'An attachment of this equipment is already in the reservation',
    );
  }

  // Check availability
  await checkAvailability(
    data.equipment_id,
    reservation['pickup_datetime'],
    reservation['return_datetime'],
    data.quantity,
    reservationId,
  );

  const result = await executeQuery<RowDataPacket[]>(
    `INSERT INTO reservation_equipment (reservation_id, equipment_id, quantity)
     VALUES (?, ?, ?)`,
    [reservationId, data.equipment_id, data.quantity],
  );
  const reservationEquipmentId = (result as any).insertId;

  // Auto-exclude attachments that are already reserved in other overlapping reservations
  const childRows = await executeQuery<RowDataPacket[]>(
    'SELECT equipment_id FROM equipment WHERE parent_equipment_id = ?',
    [data.equipment_id],
  );
  for (const child of childRows) {
    const childReservedRows = await executeQuery<RowDataPacket[]>(
      `SELECT 1 FROM reservation_equipment re
       JOIN reservations r ON re.reservation_id = r.reservation_id
       WHERE re.equipment_id = ?
         AND r.reservation_id != ?
         AND r.state IN (?, ?, ?, ?)
         AND r.pickup_datetime < ?
         AND r.return_datetime > ?`,
      [child['equipment_id'], reservationId, 'reserved', 'waiting_for_pickup', 'picked_up', 'waiting_for_return',
       reservation['return_datetime'], reservation['pickup_datetime']],
    );
    if (childReservedRows && childReservedRows['length'] > 0) {
      await executeQuery(
        'INSERT IGNORE INTO reservation_excluded_attachments (reservation_equipment_id, attachment_id) VALUES (?, ?)',
        [reservationEquipmentId, child['equipment_id']],
      );
    }
  }

  await logHistory(reservationId, userId, 'equipment_added', {
    equipment_id: data.equipment_id,
    quantity: data.quantity,
  });
  dataVersionsService.touchReservation(reservationId).catch(() => {});

  return reservationEquipmentId;
}

async function removeEquipment(
  reservationEquipmentId: number,
  userId: number,
): Promise<void> {
  const [item] = await executeQuery<RowDataPacket[]>(
    `SELECT re.reservation_id, re.equipment_id, r.state
     FROM reservation_equipment re
     JOIN reservations r ON re.reservation_id = r.reservation_id
     WHERE re.reservation_equipment_id = ?`,
    [reservationEquipmentId],
  );
  if (!item) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation equipment not found');
  }
  if (!canViewerEdit(item['state'])) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Cannot modify equipment in the current reservation state',
    );
  }

  await executeQuery('DELETE FROM reservation_equipment WHERE reservation_equipment_id = ?', [
    reservationEquipmentId,
  ]);
  await logHistory(item['reservation_id'], userId, 'equipment_removed', {
    equipment_id: item['equipment_id'],
  });
  dataVersionsService.touchReservation(item['reservation_id']).catch(() => {});
}

async function excludeAttachment(
  reservationEquipmentId: number,
  attachmentId: number,
): Promise<void> {
  // Verify the attachment belongs to the equipment
  const [item] = await executeQuery<RowDataPacket[]>(
    `SELECT re.equipment_id, r.state
     FROM reservation_equipment re
     JOIN reservations r ON re.reservation_id = r.reservation_id
     WHERE re.reservation_equipment_id = ?`,
    [reservationEquipmentId],
  );
  if (!item) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation equipment not found');
  }
  if (!canViewerEdit(item['state'])) {
    throw createHttpError(StatusCodes.CONFLICT, 'Cannot edit reservation in its current state');
  }

  const [attachment] = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM equipment WHERE equipment_id = ? AND parent_equipment_id = ?',
    [attachmentId, item['equipment_id']],
  );
  if (!attachment) {
    throw createHttpError(StatusCodes.BAD_REQUEST, 'Attachment does not belong to this equipment');
  }

  await executeQuery(
    'INSERT IGNORE INTO reservation_excluded_attachments (reservation_equipment_id, attachment_id) VALUES (?, ?)',
    [reservationEquipmentId, attachmentId],
  );
}

async function includeAttachment(
  reservationEquipmentId: number,
  attachmentId: number,
): Promise<void> {
  // Get reservation details for overlap check
  const items = await executeQuery<RowDataPacket[]>(
    `SELECT r.reservation_id, r.state, r.pickup_datetime, r.return_datetime
     FROM reservation_equipment re
     JOIN reservations r ON re.reservation_id = r.reservation_id
     WHERE re.reservation_equipment_id = ?`,
    [reservationEquipmentId],
  );
  if (!items || items['length'] === 0) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation equipment not found');
  }
  const item = items[0]!;
  if (!canViewerEdit(item['state'])) {
    throw createHttpError(StatusCodes.CONFLICT, 'Cannot edit reservation in its current state');
  }

  const reservationId = item['reservation_id'];
  // Check if this attachment is reserved in another overlapping reservation
  const conflictRows = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM reservation_equipment re
     JOIN reservations r ON re.reservation_id = r.reservation_id
     WHERE re.equipment_id = ?
       AND r.reservation_id != ?
       AND r.state IN (?, ?, ?, ?)
       AND r.pickup_datetime < ?
       AND r.return_datetime > ?`,
    [attachmentId, reservationId, 'reserved', 'waiting_for_pickup', 'picked_up', 'waiting_for_return',
     item['return_datetime'], item['pickup_datetime']],
  );
  if (conflictRows && conflictRows['length'] > 0) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Cannot include this attachment as it is already reserved in another reservation',
    );
  }

  // Also check if the attachment's parent equipment is reserved in another overlapping reservation
  const parentRows = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM reservation_equipment re
     JOIN reservations r ON re.reservation_id = r.reservation_id
     WHERE re.equipment_id = (SELECT parent_equipment_id FROM equipment WHERE equipment_id = ?)
       AND r.reservation_id != ?
       AND r.state IN (?, ?, ?, ?)
       AND r.pickup_datetime < ?
       AND r.return_datetime > ?`,
    [attachmentId, reservationId, 'reserved', 'waiting_for_pickup', 'picked_up', 'waiting_for_return',
     item['return_datetime'], item['pickup_datetime']],
  );
  if (parentRows && parentRows['length'] > 0) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Cannot include this attachment as its parent equipment is reserved in another reservation',
    );
  }

  await executeQuery(
    'DELETE FROM reservation_excluded_attachments WHERE reservation_equipment_id = ? AND attachment_id = ?',
    [reservationEquipmentId, attachmentId],
  );
}

// ---- Submit ----

async function submitReservation(reservationId: number, userId: number): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT reservation_id, class_id, receiver_person_id, pickup_datetime, return_datetime, state, notes, created_by, created_at, updated_at FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }
  if (reservation['state'] !== 'draft') {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Only draft reservations can be submitted',
    );
  }

  // Get all unique equipment group IDs in this reservation
  const equipmentRows = await executeQuery<RowDataPacket[]>(
    `SELECT DISTINCT e.group_id
     FROM reservation_equipment re
     JOIN equipment e ON re.equipment_id = e.equipment_id
     WHERE re.reservation_id = ?`,
    [reservationId],
  );
  if (equipmentRows.length === 0) {
    throw createHttpError(StatusCodes.BAD_REQUEST, 'مينفعش تعمل حجز من غير ادوات');
  }

  // Add default reviewers from each equipment group
  const groupIds = [...new Set(equipmentRows.map((r) => r['group_id'] as number))];
  for (const gid of groupIds) {
    const reviewerId = await equipmentService.getGroupDefaultReviewer(gid);
    if (reviewerId) {
      await executeQuery(
        `INSERT IGNORE INTO reservation_reviewers (reservation_id, account_id, is_default)
         VALUES (?, ?, 1)`,
        [reservationId, reviewerId],
      );
    }
  }

  // Check we have at least one reviewer
  const reviewerCount = await executeQuery<RowDataPacket[]>(
    'SELECT COUNT(reservation_reviewer_id) AS cnt FROM reservation_reviewers WHERE reservation_id = ?',
    [reservationId],
  );
  if (Number(reviewerCount[0]?.['cnt']) === 0) {
    throw createHttpError(
      StatusCodes.BAD_REQUEST,
      'No default reviewer configured for the equipment groups in this reservation',
    );
  }

  await executeQuery('UPDATE reservations SET state = ? WHERE reservation_id = ?', [
    'waiting_for_approval',
    reservationId,
  ]);
  await logHistory(reservationId, userId, 'submitted');

  // Notify all reviewers
  const reviewerIds = await getReviewerAccountIds(reservationId);
  for (const rid of reviewerIds) {
    await notificationService.notifyReviewRequired(reservationId, rid);
  }

  dataVersionsService.touchReservation(reservationId).catch(() => {});
  dataVersionsService.touchReservations().catch(() => {});
}

async function unsubmitReservation(reservationId: number, userId: number): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT reservation_id, state, created_by FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }
  if (reservation['state'] !== 'waiting_for_approval') {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Only waiting_for_approval reservations can be reverted to draft',
    );
  }
  if (reservation['created_by'] !== userId) {
    const isOrg = await isUserOrganizerOfReservation(userId, reservationId);
    if (!isOrg) {
      throw createHttpError(StatusCodes.FORBIDDEN, 'Not authorized to revert this reservation');
    }
  }

  await executeQuery('UPDATE reservations SET state = ? WHERE reservation_id = ?', [
    'draft',
    reservationId,
  ]);

  // Reset all reviewer statuses to pending so fresh reviews are required on next submit
  await executeQuery(
    'UPDATE reservation_reviewers SET status = ?, reviewed_at = NULL WHERE reservation_id = ?',
    ['pending', reservationId],
  );

  await logHistory(reservationId, userId, 'draft');
  dataVersionsService.touchReservation(reservationId).catch(() => {});
  dataVersionsService.touchReservations().catch(() => {});
}

// ---- Reviewers ----

async function getReviewerAccountIds(reservationId: number): Promise<number[]> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT account_id FROM reservation_reviewers WHERE reservation_id = ?',
    [reservationId],
  );
  return rows.map((r) => r['account_id']);
}

async function getReservationReviewers(reservationId: number): Promise<RowDataPacket[]> {
  return executeQuery<RowDataPacket[]>(
    `SELECT rr.reservation_reviewer_id, rr.account_id, rr.is_default, rr.status, rr.reviewed_at,
            a.username, a.real_name
     FROM reservation_reviewers rr
     JOIN accounts a ON rr.account_id = a.account_id
     WHERE rr.reservation_id = ?
     ORDER BY rr.is_default DESC, rr.created_at`,
    [reservationId],
  );
}

async function addReviewer(
  reservationId: number,
  accountId: number,
  userId: number,
): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT state FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }
  if (!canViewerEdit(reservation['state'])) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Cannot modify reviewers in the current reservation state',
    );
  }

  const isOrg = await isUserOrganizerOfReservation(userId, reservationId);
  if (!isOrg) {
    throw createHttpError(StatusCodes.FORBIDDEN, 'Only organizers can add reviewers');
  }

  // Verify the account being added is an organizer of the reservation's equipment group
  const [rows] = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM equipment_group_members egm
     JOIN reservations r ON r.reservation_id = ?
     WHERE egm.group_id = r.group_id
       AND egm.account_id = ?
       AND egm.access_level = 'organizer'`,
    [reservationId, accountId],
  );
  if (!rows || rows['length'] === 0) {
    throw createHttpError(StatusCodes.BAD_REQUEST, 'Only equipment group organizers can be reviewers');
  }

  await executeQuery(
    `INSERT IGNORE INTO reservation_reviewers (reservation_id, account_id, is_default)
     VALUES (?, ?, 0)`,
    [reservationId, accountId],
  );
  await logHistory(reservationId, userId, 'reviewer_added', { account_id: accountId });
}

async function removeReviewer(
  reservationReviewerId: number,
  userId: number,
): Promise<void> {
  const [reviewer] = await executeQuery<RowDataPacket[]>(
    'SELECT r.state, rr.reservation_id, rr.is_default FROM reservation_reviewers rr JOIN reservations r ON rr.reservation_id = r.reservation_id WHERE rr.reservation_reviewer_id = ?',
    [reservationReviewerId],
  );
  if (!reviewer) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reviewer not found');
  }
  if (!canViewerEdit(reviewer['state'])) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      'Cannot modify reviewers in the current reservation state',
    );
  }

  const isOrg = await isUserOrganizerOfReservation(userId, reviewer['reservation_id']);
  if (!isOrg) {
    throw createHttpError(StatusCodes.FORBIDDEN, 'Only organizers can remove reviewers');
  }
  if (reviewer['is_default']) {
    throw createHttpError(StatusCodes.CONFLICT, 'Cannot remove the default reviewer');
  }

  await executeQuery('DELETE FROM reservation_reviewers WHERE reservation_reviewer_id = ?', [
    reservationReviewerId,
  ]);
  await logHistory(reviewer['reservation_id'], userId, 'reviewer_removed');
}

// ---- Approval workflow ----

async function approveReservation(
  reservationId: number,
  userId: number,
  notes?: string | null,
): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT state, receiver_person_id FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }
  if (reservation['state'] !== 'waiting_for_approval') {
    throw createHttpError(StatusCodes.CONFLICT, 'Reservation is not waiting for approval');
  }

  // Check user is a reviewer with pending status
  const [reviewer] = await executeQuery<RowDataPacket[]>(
    'SELECT reservation_reviewer_id FROM reservation_reviewers WHERE reservation_id = ? AND account_id = ? AND status = ?',
    [reservationId, userId, 'pending'],
  );
  if (!reviewer) {
    throw createHttpError(
      StatusCodes.FORBIDDEN,
      'You are not a pending reviewer for this reservation',
    );
  }

  await executeQuery(
    'UPDATE reservation_reviewers SET status = ?, reviewed_at = NOW() WHERE reservation_reviewer_id = ?',
    ['approved', reviewer['reservation_reviewer_id']],
  );
  await logHistory(reservationId, userId, 'approved', notes ? { notes } : undefined);

  // Check if all reviewers approved
  const pendingCount = await executeQuery<RowDataPacket[]>(
    "SELECT COUNT(reservation_reviewer_id) AS cnt FROM reservation_reviewers WHERE reservation_id = ? AND status != 'approved'",
    [reservationId],
  );
  if (Number(pendingCount[0]?.['cnt']) === 0) {
    await executeQuery('UPDATE reservations SET state = ? WHERE reservation_id = ?', [
      'reserved',
      reservationId,
    ]);
    await logHistory(reservationId, userId, 'reserved');
    const receiverAccountIds = await getAccountIdsForPerson(reservation['receiver_person_id']);
    for (const accountId of receiverAccountIds) {
      await notificationService.notifyReservationAccepted(reservationId, accountId);
    }
  }

  dataVersionsService.touchReservation(reservationId).catch(() => {});
  dataVersionsService.touchReservations().catch(() => {});
}

async function reopenReservation(reservationId: number, userId: number): Promise<void> {
  await transitionState(reservationId, userId, 'reserved', 'draft', 'reopened');

  // Reset reviewer statuses to pending so fresh reviews are required
  await executeQuery(
    'UPDATE reservation_reviewers SET status = ?, reviewed_at = NULL WHERE reservation_id = ?',
    ['pending', reservationId],
  );
}

async function rejectReservation(
  reservationId: number,
  userId: number,
  notes?: string | null,
): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT state, receiver_person_id FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }
  if (reservation['state'] !== 'waiting_for_approval') {
    throw createHttpError(StatusCodes.CONFLICT, 'Reservation is not waiting for approval');
  }

  const [reviewer] = await executeQuery<RowDataPacket[]>(
    'SELECT reservation_reviewer_id FROM reservation_reviewers WHERE reservation_id = ? AND account_id = ?',
    [reservationId, userId],
  );
  if (!reviewer) {
    throw createHttpError(StatusCodes.FORBIDDEN, 'You are not a reviewer for this reservation');
  }

  // Set state back to draft so the user can rework
  await executeQuery('UPDATE reservations SET state = ? WHERE reservation_id = ?', [
    'draft',
    reservationId,
  ]);
  await executeQuery(
    "UPDATE reservation_reviewers SET status = 'pending', reviewed_at = NULL WHERE reservation_id = ?",
    [reservationId],
  );
  await logHistory(reservationId, userId, 'rejected', notes ? { notes } : undefined);
  const receiverAccountIds = await getAccountIdsForPerson(reservation['receiver_person_id']);
  for (const accountId of receiverAccountIds) {
    await notificationService.notifyReservationRejected(reservationId, accountId);
  }

  dataVersionsService.touchReservation(reservationId).catch(() => {});
  dataVersionsService.touchReservations().catch(() => {});
}

// ---- State transitions (organizer) ----

async function markWaitingForPickup(reservationId: number, userId: number): Promise<void> {
  await transitionState(reservationId, userId, 'reserved', 'waiting_for_pickup', 'marked_for_pickup');
}

async function markPickedUp(reservationId: number, userId: number): Promise<void> {
  await transitionState(reservationId, userId, 'waiting_for_pickup', 'picked_up', 'picked_up');
}

async function markWaitingForReturn(reservationId: number, userId: number): Promise<void> {
  await transitionState(reservationId, userId, 'picked_up', 'waiting_for_return', 'marked_for_return');
}

async function markReturned(reservationId: number, userId: number): Promise<void> {
  await transitionState(reservationId, userId, 'waiting_for_return', 'returned', 'returned');
}

async function transitionState(
  reservationId: number,
  userId: number,
  expectedFrom: ReservationState,
  targetState: ReservationState,
  historyAction: string,
): Promise<void> {
  const [reservation] = await executeQuery<RowDataPacket[]>(
    'SELECT state FROM reservations WHERE reservation_id = ?',
    [reservationId],
  );
  if (!reservation) {
    throw createHttpError(StatusCodes.NOT_FOUND, 'Reservation not found');
  }

  const isOrg = await isUserOrganizerOfReservation(userId, reservationId);
  if (!isOrg) {
    throw createHttpError(StatusCodes.FORBIDDEN, 'Only organizers can perform this action');
  }

  if (reservation['state'] !== expectedFrom) {
    throw createHttpError(
      StatusCodes.CONFLICT,
      `Reservation must be in '${expectedFrom}' state to mark as '${targetState}'`,
    );
  }

  await executeQuery('UPDATE reservations SET state = ? WHERE reservation_id = ?', [
    targetState,
    reservationId,
  ]);
  await logHistory(reservationId, userId, historyAction);
  dataVersionsService.touchReservation(reservationId).catch(() => {});
  dataVersionsService.touchReservations().catch(() => {});
}

// ---- Authorization helpers ----

async function isUserOrganizerOfReservation(
  userId: number,
  reservationId: number,
): Promise<boolean> {
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM reservation_equipment re
     JOIN equipment e ON re.equipment_id = e.equipment_id
     JOIN equipment_group_members egm ON egm.group_id = e.group_id AND egm.account_id = ? AND egm.access_level = 'organizer'
     WHERE re.reservation_id = ?
     LIMIT 1`,
    [userId, reservationId],
  );
  return rows.length > 0;
}

async function isUserReviewerOfReservation(
  userId: number,
  reservationId: number,
): Promise<boolean> {
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT 1 FROM reservation_reviewers WHERE reservation_id = ? AND account_id = ? LIMIT 1',
    [reservationId, userId],
  );
  return rows.length > 0;
}

async function isUserCreatorOrReceiver(
  userId: number,
  reservationId: number,
): Promise<boolean> {
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM reservations
     WHERE reservation_id = ?
       AND (created_by = ? OR receiver_person_id = (SELECT person_id FROM accounts WHERE account_id = ?))
     LIMIT 1`,
    [reservationId, userId, userId],
  );
  return rows.length > 0;
}

async function isUserInvolvedInReservation(
  userId: number,
  reservationId: number,
): Promise<boolean> {
  if (await isUserCreatorOrReceiver(userId, reservationId)) return true;
  if (await isUserReviewerOfReservation(userId, reservationId)) return true;
  if (await isUserOrganizerOfReservation(userId, reservationId)) return true;
  // Any user with a role in the reservation's class can view it
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT 1 FROM reservations r
     JOIN roles ro ON ro.class_id = r.class_id AND ro.account_id = ?
     WHERE r.reservation_id = ?
     LIMIT 1`,
    [userId, reservationId],
  );
  return rows.length > 0;
}

// ---- Scheduled job ----

let schedulerInterval: ReturnType<typeof setInterval> | null = null;

function startScheduler(): void {
  if (schedulerInterval) return;
  schedulerInterval = setInterval(async () => {
    try {
      await processUpcomingPickups();
    } catch (err) {
      console.error('[ReservationScheduler] pickup error:', err);
    }
    try {
      await processUpcomingReturns();
    } catch (err) {
      console.error('[ReservationScheduler] return error:', err);
    }
  }, 60_000);
  console.log('[ReservationScheduler] started (interval: 60s)');
}

function stopScheduler(): void {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}

async function processUpcomingPickups(): Promise<void> {
  const now = new Date();
  const egyptNowStr = now.toLocaleString('en-CA', { timeZone: 'Africa/Cairo', hour12: false }).replace(',', '');
  const in30 = new Date(now.getTime() + 30 * 60 * 1000);
  const egyptIn30 = in30.toLocaleString('en-CA', { timeZone: 'Africa/Cairo', hour12: false }).replace(',', '');
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT reservation_id, receiver_person_id, created_by
     FROM reservations
     WHERE state = 'reserved'
       AND pickup_datetime <= ?
       AND pickup_datetime > ?`,
    [egyptIn30, egyptNowStr],
  );
  for (const row of rows) {
    const id = row['reservation_id'];
    await executeQuery('UPDATE reservations SET state = ? WHERE reservation_id = ?', [
      'waiting_for_pickup',
      id,
    ]);
    await logHistory(id, 0, 'state_auto', { from: 'reserved', to: 'waiting_for_pickup' });
    const organizerIds = await getOrganizerAccountIdsForReservation(id);
    const receiverAccountIds = await getAccountIdsForPerson(row['receiver_person_id']);
    const notifyIds = [
      ...receiverAccountIds,
      row['created_by'],
      ...organizerIds,
    ];
    await notificationService.notifyPickupReminder(id, [...new Set(notifyIds)]);
    dataVersionsService.touchReservation(id).catch(() => {});
  }
}

async function processUpcomingReturns(): Promise<void> {
  const now = new Date();
  const egyptNowStr = now.toLocaleString('en-CA', { timeZone: 'Africa/Cairo', hour12: false }).replace(',', '');
  const in30 = new Date(now.getTime() + 30 * 60 * 1000);
  const egyptIn30 = in30.toLocaleString('en-CA', { timeZone: 'Africa/Cairo', hour12: false }).replace(',', '');
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT reservation_id, receiver_person_id, created_by
     FROM reservations
     WHERE state = 'picked_up'
       AND return_datetime <= ?
       AND return_datetime > ?`,
    [egyptIn30, egyptNowStr],
  );
  for (const row of rows) {
    const id = row['reservation_id'];
    await executeQuery('UPDATE reservations SET state = ? WHERE reservation_id = ?', [
      'waiting_for_return',
      id,
    ]);
    await logHistory(id, 0, 'state_auto', { from: 'picked_up', to: 'waiting_for_return' });
    const organizerIds = await getOrganizerAccountIdsForReservation(id);
    const receiverAccountIds = await getAccountIdsForPerson(row['receiver_person_id']);
    const notifyIds = [
      ...receiverAccountIds,
      row['created_by'],
      ...organizerIds,
    ];
    await notificationService.notifyReturnReminder(id, [...new Set(notifyIds)]);
    dataVersionsService.touchReservation(id).catch(() => {});
  }
}

async function getOrganizerAccountIdsForReservation(reservationId: number): Promise<number[]> {
  const rows = await executeQuery<RowDataPacket[]>(
    `SELECT DISTINCT egm.account_id
     FROM reservation_equipment re
     JOIN equipment e ON re.equipment_id = e.equipment_id
     JOIN equipment_group_members egm ON egm.group_id = e.group_id AND egm.access_level = 'organizer'
     WHERE re.reservation_id = ?`,
    [reservationId],
  );
  return rows.map((r) => r['account_id']);
}

async function getAccountIdsForPerson(personId: number): Promise<number[]> {
  if (!personId) return [];
  const rows = await executeQuery<RowDataPacket[]>(
    'SELECT account_id FROM accounts WHERE person_id = ?',
    [personId],
  );
  return rows.map((r) => r['account_id']);
}

async function ensureReservationGroupIdColumn(): Promise<void> {
  await executeQuery(
    `ALTER TABLE reservations
     ADD COLUMN group_id INT DEFAULT NULL,
     ADD FOREIGN KEY (group_id) REFERENCES equipment_groups(group_id) ON DELETE SET NULL`,
  ).catch(() => {
    // Column already exists
  });
}

export default {
  ensureTables,
  createReservation,
  getReservations,
  getReservationById,
  updateReservation,
  deleteReservation,
  addEquipment,
  removeEquipment,
  excludeAttachment,
  includeAttachment,
  submitReservation,
  unsubmitReservation,
  getReservationReviewers,
  addReviewer,
  removeReviewer,
  approveReservation,
  rejectReservation,
  reopenReservation,
  markWaitingForPickup,
  markWaitingForReturn,
  markPickedUp,
  markReturned,
  checkAvailability,
  isUserOrganizerOfReservation,
  isUserReviewerOfReservation,
  isUserCreatorOrReceiver,
  isUserInvolvedInReservation,
  startScheduler,
  stopScheduler,
  ensureReservationGroupIdColumn,
};
