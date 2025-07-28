PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    job_id TEXT,
    service_id INTEGER,
    url TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
INSERT INTO photos VALUES('8d4e81af-1250-415d-ed78-a8ce4e9c7600',40,NULL,NULL,'https://imagedelivery.net/T3jM3_Z9ULoA9Ej1nTbmVw/8d4e81af-1250-415d-ed78-a8ce4e9c7600/public','2025-07-14 21:21:03');
INSERT INTO photos VALUES('88c51b4a-559b-4912-d171-4f2746b99b00',40,'9633616d-4dbe-415d-a03d-b947901fb28e',100,'https://imagedelivery.net/T3jM3_Z9ULoA9Ej1nTbmVw/88c51b4a-559b-4912-d171-4f2746b99b00/public','2025-07-21 00:31:03');
INSERT INTO photos VALUES('8c238493-eda1-45ed-2baf-e9e8397f8600',41,NULL,NULL,'https://imagedelivery.net/T3jM3_Z9ULoA9Ej1nTbmVw/8c238493-eda1-45ed-2baf-e9e8397f8600/public','2025-07-22 17:46:21');
INSERT INTO photos VALUES('4f6b211b-03c6-4ba3-2829-7380af6aa700',40,'ba00a897-c7af-4c3f-b83d-f37e8bad2c6b',101,'https://imagedelivery.net/T3jM3_Z9ULoA9Ej1nTbmVw/4f6b211b-03c6-4ba3-2829-7380af6aa700/public','2025-07-23 20:06:55');
