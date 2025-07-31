PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO d1_migrations VALUES(1,'0001_initial_schema.sql','2025-07-28 02:00:44');
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT,
  stripe_customer_id TEXT,
  phone TEXT UNIQUE,
  role TEXT NOT NULL DEFAULT 'customer',
  address TEXT,
  company_name TEXT,
  email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  sms_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  preferred_contact_method TEXT CHECK(preferred_contact_method IN ('email', 'sms')) DEFAULT 'email',
  calendar_reminders_enabled INTEGER NOT NULL DEFAULT 1,
  calendar_reminder_minutes INTEGER NOT NULL DEFAULT 60
);
INSERT INTO users VALUES(1,'mwb@777.foo','Mitchell Beck','$2a$10$M9z7JqxFWx4uzqBFUgEpCu99OgYgZd3kbwejvT.qa6EGIw2SQLbXq','cus_SdeWYV6pZ3SUdh','7705477319','admin',NULL,'777 Solutions LLC',1,1,'email',1,60);
INSERT INTO users VALUES(2,'schulte10@gmail.com','Mike Schulte','','cus_S8xnJROJZa3lo3',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(3,'prhroberts@aol.com','Pam Roberts','','cus_S1NLsai4e1oS7f',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(4,'angie@gafestivaloftrees.org','Georgia Festival of Trees','','cus_RqD1T1PZ2jZm6J',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(5,'sarakv83@gmail.com','Sara Kay','','cus_Rlz2bri7pRUcu0',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(6,'msmollygunn@gmail.com','Molly Gunn','','cus_Rigl3WhshqZrDb',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(7,'mostsevere@hotmail.com','Dale Ralston','','cus_RfItyagiBZKV8u',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(8,'benharbin89@gmail.com','Ben Harbin','','cus_ROogCbuVKDAquu',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(9,'deboleenaroy2@gmail.com','Deboleena Roy','','cus_RHJ6W0p26Tqgsy',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(10,'matt@dwellcommunities.com','Matt O''Shaughnessy','','cus_R8FpKITf2qXE1r',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(11,'marthatkim@gmail.com','Martha Sybblis','','cus_R7VaJDgpWtghJP',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(12,'thahhjans@gmail.com','','','cus_R4eXIbSWARP5Cs',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(13,'4atkinson@comcast.net','Andrea Atkinson','','cus_R4Zgjyj04ONcGM',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(14,'jenniferprewettatl@gmail.com','Jennifer Prewett','','cus_Ql7dPei8rF97WU',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(15,'monkeybonemail@yahoo.com','David','','cus_Ql7WhZIubGrBNr',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(16,'blanedavor@gmail.com','Davor','','cus_Qadvo9JCYrg0ZK',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(17,'mhamlin@vineyard-company.com','Winnwood Retirement Community','','cus_QZvcpjhoXo6UNt',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(18,'gingerkcooper@gmail.com','Ginger Cooper','','cus_QZOmoDF5wEFjkc',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(19,'dougsuddeth@gmail.com','Doug Suddeth','','cus_QXwqaU7H9TA1qS',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(20,'geswords@comcast.net','Gordon Swordsma','','cus_QXUB9tpvRM14k2',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(21,'rowenap@bellsouth.net','Rowena Preisinger','','cus_QVQhBw7QayIGcE',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(22,'garth.basson@gmail.com','Garth Basson','','cus_QVQQyEpJPsijXu',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(23,'kaelin.hentrup@sodexo.com','Kaelin Hentrup','','cus_QPLU4hpmD8TH0i',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(24,'beckywbeck@comcast.net','Rebekah Beck','$2a$10$lPyU7bhRk5PjITIr9wcgRuviirIKH2CdhFicYOBuDUCocGBy78ZEG','cus_QOBrqwDszMQVRA','7703095168','customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(25,'linda@advantagesolve.net','Pritchard Park Subdivision','','cus_QMifNJriXA6dFV',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(26,'mizellwill@gmail.com','Will Mizel','','cus_QMhhXS7MdcwJu3',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(27,'calhounmetalworks@earthlink.net','Charles Calhoun','','cus_QK6r2gJVEfQoS7',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(28,'trentgl@gmail.com','Trent Leonard','','cus_QH5HxqdLoV8dqi',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(29,'tyeason@comcast.net','Tyler Eason','','cus_QECin0rDu2VXmU',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(30,'gnits@outlook.com','Darrin Daigle','','cus_QE3R3eJKN9rK5n',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(31,'rlmjr2300@gmail.com','Richard McGowan','','cus_QBomNQ0LnzmEl0',NULL,'customer',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(40,'bmw@777.foo','Bimmer Mick','$2a$10$znCrE/CIFcBxts2Mdcwm3.1ezQO24HzL4Mun2N4raWj./zuqYUC3.','cus_SfyjHnzUxSLqj5','3333333333','customer',NULL,'slav world inc',1,1,'email',1,60);
INSERT INTO users VALUES(41,'iant2378@gmail.com','Ian Thompson',NULL,NULL,'14047096763','guest','179 Forest Ave NE Marietta GA 30060 United States',NULL,1,1,'email',1,60);
INSERT INTO users VALUES(42,'addycreasman@gmail.com','Addy Creasman',NULL,NULL,'7703098372','guest','2594 Cricket Ct Marietta GA 30064 United States',NULL,1,1,'email',1,60);
INSERT INTO users VALUES(43,'p.capone69@gmail.com','Vegas',NULL,NULL,'4049188744','guest','3500 Windcliff Dr SE Apt 317, Marietta, GA 30067, USA',NULL,1,1,'email',1,60);
INSERT INTO users VALUES(44,NULL,'Duke',NULL,'cus_SYRhiFPOUjVL8P','+14047754750','guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(45,'casey@southernmanorhomes.com','Southern Manner Homes LLC',NULL,'cus_Rv3F3VoaraKqo0',NULL,'guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(46,'austindevore1@gmail.com','Austin Davore',NULL,'cus_SLeaw43u4TqwKI',NULL,'guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(47,'marywfeske@gmail.com','Mary Feske',NULL,'cus_QVQaLJea6Bw7rI','+14044020159','guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(48,NULL,'David Odom',NULL,'cus_RpjFCFWqeWPVtj',NULL,'guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(49,NULL,'Drew Downey',NULL,'cus_RpiyKH8v504IXT',NULL,'guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(50,NULL,'Allison Ruus',NULL,'cus_RfJ8GKwtRP5NRM','+14045181976','guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(51,NULL,'Caroline Nichols',NULL,'cus_RY9UPVEB9N4ldY',NULL,'guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(52,NULL,'David Baker',NULL,'cus_ROoxh8zA5PjB2O','+17707102330','guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(53,NULL,'Rachel Niesen',NULL,'cus_QWxZJfLK0G5jdS',NULL,'guest',NULL,NULL,1,1,'email',1,60);
INSERT INTO users VALUES(54,NULL,'Riley Bauling',NULL,'cus_QVR34qWfNOkWAj',NULL,'guest',NULL,NULL,1,1,'email',1,60);
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL,
  recurrence TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  stripe_invoice_id TEXT,
  stripe_quote_id TEXT,
  total_amount_cents INTEGER,
  due TEXT
);
INSERT INTO jobs VALUES('64c836ad-ed39-43f0-ac91-d0567ff63e8f','9.0','Add Open Valley Flashing (2) Valleys',replace('Address: \n149 Feld Ave\nDecatur, GA  30030\nUnited States','\n',char(10)),'pending','none','2025-07-31 15:20:44','2025-07-31 15:20:44',NULL,'qt_1R2ysoHNec9XrT0FSSUgIeHO',292500,'2025-04-14T17:52:26.000Z');
CREATE TABLE line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  item TEXT,
  total_amount_cents INTEGER,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
CREATE TABLE photos (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    invoice_id TEXT,
    item_id INTEGER,
    job_id TEXT,
    url TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(item_id) REFERENCES line_items(id),
    FOREIGN KEY(job_id) REFERENCES jobs(id)
);
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  channels TEXT, 
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'failed')),
  metadata TEXT, 
  push_subscription_json TEXT,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE job_recurrence_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  frequency INTEGER NOT NULL,
  requested_day INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'countered')),
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  updatedAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  token TEXT NOT NULL UNIQUE,
  due TEXT NOT NULL,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE calendar_tokens (
  token TEXT PRIMARY KEY NOT NULL,
  user_id INTEGER NOT NULL UNIQUE,
  createdAt TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);
CREATE TABLE notes (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, photo_id TEXT, item_id INTEGER, job_id TEXT, content TEXT NOT NULL, createdAt TEXT NOT NULL DEFAULT (datetime('now')), updatedAt TEXT NOT NULL DEFAULT (datetime('now')), FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(photo_id) REFERENCES photos(id), FOREIGN KEY(item_id) REFERENCES line_items(id), FOREIGN KEY(job_id) REFERENCES jobs(id));
CREATE TABLE calendar_events (   id INTEGER PRIMARY KEY AUTOINCREMENT,   title TEXT NOT NULL,   start TEXT NOT NULL,   "end" TEXT NOT NULL,   type TEXT NOT NULL CHECK (type IN ('job', 'blocked', 'personal')),   job_id TEXT,   user_id INTEGER,   createdAt TEXT NOT NULL DEFAULT (datetime('now')),   FOREIGN KEY(user_id) REFERENCES users(id),   FOREIGN KEY(job_id) REFERENCES jobs(id) );
DELETE FROM sqlite_sequence;
INSERT INTO sqlite_sequence VALUES('d1_migrations',1);
INSERT INTO sqlite_sequence VALUES('users',54);
INSERT INTO sqlite_sequence VALUES('password_reset_tokens',2);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_line_items_job_id ON line_items(job_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_job_recurrence_requests_job_id ON job_recurrence_requests(job_id);
CREATE INDEX idx_job_recurrence_requests_status ON job_recurrence_requests(status);
CREATE INDEX idx_calendar_tokens_user_id ON calendar_tokens(user_id);
