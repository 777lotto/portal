PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    user_id INTEGER,
    photo_id TEXT,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (photo_id) REFERENCES photos(id) ON DELETE CASCADE
);
INSERT INTO notes VALUES(2,NULL,40,'8d4e81af-1250-415d-ed78-a8ce4e9c7600','face-card-valid','2025-07-14 21:21:33');
INSERT INTO notes VALUES(3,'9633616d-4dbe-415d-a03d-b947901fb28e',40,'88c51b4a-559b-4912-d171-4f2746b99b00','joist broke.','2025-07-21 00:31:03');
INSERT INTO notes VALUES(4,'ba00a897-c7af-4c3f-b83d-f37e8bad2c6b',40,'4f6b211b-03c6-4ba3-2829-7380af6aa700','broken osb view','2025-07-23 20:06:55');
