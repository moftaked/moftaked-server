CREATE TABLE IF NOT EXISTS equipment_groups (
  group_id INT NOT NULL AUTO_INCREMENT,
  group_name VARCHAR(255) NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (group_id),
  FOREIGN KEY (created_by) REFERENCES accounts(account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS equipment_subgroups (
  subgroup_id INT NOT NULL AUTO_INCREMENT,
  group_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (subgroup_id),
  FOREIGN KEY (group_id) REFERENCES equipment_groups(group_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS equipment (
  equipment_id INT NOT NULL AUTO_INCREMENT,
  group_id INT NOT NULL,
  subgroup_id INT DEFAULT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  quantity INT NOT NULL DEFAULT 1,
  photo VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (equipment_id),
  FOREIGN KEY (group_id) REFERENCES equipment_groups(group_id) ON DELETE CASCADE,
  FOREIGN KEY (subgroup_id) REFERENCES equipment_subgroups(subgroup_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS equipment_group_members (
  id INT NOT NULL AUTO_INCREMENT,
  group_id INT NOT NULL,
  account_id INT NOT NULL,
  access_level ENUM('organizer', 'viewer') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY (group_id, account_id),
  FOREIGN KEY (group_id) REFERENCES equipment_groups(group_id) ON DELETE CASCADE,
  FOREIGN KEY (account_id) REFERENCES accounts(account_id) ON DELETE CASCADE
);
