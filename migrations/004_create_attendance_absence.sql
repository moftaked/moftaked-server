CREATE TABLE IF NOT EXISTS attendance_absence (
  person_id int NOT NULL,
  event_occurence_id int NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (person_id, event_occurence_id),
  FOREIGN KEY (person_id) REFERENCES persons(person_id) ON DELETE CASCADE,
  FOREIGN KEY (event_occurence_id) REFERENCES event_occurence(event_occurence_id) ON DELETE CASCADE
);
