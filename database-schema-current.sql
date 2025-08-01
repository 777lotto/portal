PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO d1_migrations VALUES(1,'0001_initial_schema.sql','2025-07-28 02:00:44');
INSERT INTO d1_migrations VALUES(2,'0002_update_line_items.sql','2025-07-31 18:59:47');
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
INSERT INTO jobs VALUES('0c8e4358-7c23-4cc3-a210-24524b996db0','48.0','Pressure Wash House & Back Patio',replace('Address:\n1760 Clairmont Way NE\nBrookhaven, GA  30329\nUnited States','\n',char(10)),'pending','none','2025-07-31 18:50:10','2025-07-31 18:50:10',NULL,'qt_1Qw3mnHNec9XrT0FNvfRahHv',45000,'2025-03-26T14:32:08.000Z');
INSERT INTO jobs VALUES('34f97039-8469-420e-8ce2-b04aec997266','14.0','Roof Wash','Imported from Stripe Quote #QT-3DC1C4AF-0001-2','pending','none','2025-07-31 19:00:50','2025-07-31 19:00:50',NULL,'qt_1Pw69eHNec9XrT0FkO0AeBdF',45500,'2024-10-06T17:41:06.000Z');
INSERT INTO jobs VALUES('7d09d3c0-35eb-4f02-9382-e29f762e3fd2','21.0','Roof Repair','Imported from Stripe Quote #QT-40BDD61E-0001-1','pending','none','2025-07-31 19:00:50','2025-07-31 19:00:50',NULL,'qt_1PjlHhHNec9XrT0F7YjBKu57',35000,'2024-09-02T16:58:22.000Z');
INSERT INTO jobs VALUES('e905c6b6-7fe0-40d9-9b91-e90114775982','26.0','Roof Wash','Imported from Stripe Quote #QT-5663ED2A-0001-1','pending','none','2025-07-31 19:00:50','2025-07-31 19:00:50',NULL,'qt_1PVyIYHNec9XrT0FFotfnAEL',75000,'2024-07-26T15:55:55.000Z');
INSERT INTO jobs VALUES('bbebb071-0d75-44a3-bbb9-63f5a474e534','27.0','Pressure Wash House','Imported from Stripe Quote #QT-ECAAE4F4-0001-1','pending','none','2025-07-31 19:00:50','2025-07-31 19:00:50',NULL,'qt_1PTSe9HNec9XrT0F0ZmkeBfG',57500,'2024-07-19T17:49:26.000Z');
INSERT INTO jobs VALUES('139094ef-febd-4fed-9e75-8d60d61890b0','40.0','Repair Broken Joist','Invoice for: A Friendly Gesture','complete','none','2025-07-20T23:13:42.000Z','2025-07-31 19:20:40','in_1Rn6QMHNec9XrT0F37M0Ycmv',NULL,100,'2025-10-18T23:13:42.000Z');
INSERT INTO jobs VALUES('1fc2e435-9285-401a-99c7-ba3496725667','44.0','Pressure Wash Walkways & Pool Area','Imported from Stripe Invoice #7-0079','complete','none','2025-06-24T00:33:45.000Z','2025-07-31 19:20:40','in_1RdKo1HNec9XrT0Fz9qL2IFu',NULL,25000,'2025-07-24T00:35:10.000Z');
INSERT INTO jobs VALUES('6b648b9a-b0ba-42fd-bcc8-7a3e1691c5f7','45.0','Gutter Cleaning **','Imported from Stripe Invoice #7-0078','complete','none','2025-06-23T17:56:33.000Z','2025-07-31 19:20:40','in_1RdEbdHNec9XrT0FytghXV6X',NULL,69000,'2025-07-23T18:11:10.000Z');
INSERT INTO jobs VALUES('3b43428b-0226-46ff-9dc9-2da27861995a','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0077','complete','none','2025-06-23T17:18:54.000Z','2025-07-31 19:20:41','in_1RdE1CHNec9XrT0F8c0IclzM',NULL,90000,'2025-06-30T17:20:57.000Z');
INSERT INTO jobs VALUES('c68f70b8-5b64-495f-bb84-e3c38643a1dc','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0076','complete','none','2025-05-24T18:13:17.000Z','2025-07-31 19:20:41','in_1RSMZNHNec9XrT0FZonGC5uo',NULL,90000,'2025-06-07T18:15:00.000Z');
INSERT INTO jobs VALUES('5c01368b-6c04-43ac-a46b-ad2575d2a6b9','46.0','Gutter Cleaning','Imported from Stripe Invoice #7-0075','complete','none','2025-05-20T21:00:32.000Z','2025-07-31 19:20:41','in_1RQxH2HNec9XrT0Fvfh98Hql',NULL,18000,'2025-05-27T21:01:50.000Z');
INSERT INTO jobs VALUES('6fca4366-79d7-492d-8b7e-a45710da4474','47.0','Clean Skylights','Imported from Stripe Invoice #7-0074','complete','none','2025-05-16T03:13:10.000Z','2025-07-31 19:20:41','in_1RPEhuHNec9XrT0FpdZDRgxY',NULL,19500,'2025-05-25T23:15:19.000Z');
INSERT INTO jobs VALUES('ee68fba6-594b-4d47-8d5b-774ed67fc37d','22.0','Gutter Cleaning','Imported from Stripe Invoice #7-0072','complete','none','2025-04-30T20:45:40.000Z','2025-07-31 19:20:41','in_1RJhVgHNec9XrT0Fpn8nx3MB',NULL,19500,'2025-05-07T20:47:48.000Z');
INSERT INTO jobs VALUES('df168945-037e-4872-a00e-2d32bf8a04ac','21.0','Roof Repair',replace('Address: \n2102 Valley Oaks Dr SE\nSmyrna, GA  30080\nUnited States','\n',char(10)),'complete','none','2025-04-25T01:58:19.000Z','2025-07-31 19:20:41','in_1RHbWxHNec9XrT0FtCp6eaE9',NULL,18000,'2025-05-09T02:00:51.000Z');
INSERT INTO jobs VALUES('f993ac96-21e6-49ea-8aaf-9bf8e62548e2','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0070','complete','none','2025-04-23T18:26:59.000Z','2025-07-31 19:20:41','in_1RH80dHNec9XrT0FqXzaVA3V',NULL,90000,'2025-05-23T18:28:20.000Z');
INSERT INTO jobs VALUES('eca713a2-7ac3-4e45-a4b4-66a2889cff11','2.0','Gutter Cleaning','Imported from Stripe Invoice #7-0068','complete','none','2025-04-16T23:59:42.000Z','2025-07-31 19:20:41','in_1REfrmHNec9XrT0FVmKi6DZs',NULL,18000,'2025-04-24T00:09:28.000Z');
INSERT INTO jobs VALUES('25a85364-62ff-4be8-ba5e-555634247dbe','3.0','Gutter Cleaning',replace('Address:\n2868 Cherokee Cove\nStone Mountain  30087','\n',char(10)),'complete','none','2025-03-27T17:52:14.000Z','2025-07-31 19:20:41','in_1R7KbCHNec9XrT0F43g1dYFc',NULL,17000,'2025-04-03T17:56:46.000Z');
INSERT INTO jobs VALUES('2d90ede2-dd3c-43d2-af78-e42d447beb8c','9.0','Add Open Valley Flashing (2) Valleys','Imported from Stripe Invoice #7-0059','complete','none','2025-03-18T19:23:28.000Z','2025-07-31 19:20:42','in_1R45jYHNec9XrT0FaQzXEmk9',NULL,292500,'2025-04-17T19:23:47.000Z');
INSERT INTO jobs VALUES('1b943e86-14b4-4469-8e02-630554a357cd','48.0','Pressure Wash House & Back Patio',replace('Address: \n1760 Clairmont Way NE\nBrookhaven, GA  30329','\n',char(10)),'complete','none','2025-03-07T20:38:04.000Z','2025-07-31 19:20:42','in_1R07eiHNec9XrT0FejCovsm5',NULL,45000,'2025-04-06T20:39:44.000Z');
INSERT INTO jobs VALUES('ee18d68a-67ed-4a18-b4a9-4555bd3890e8','17.0','Gutter Cleaning','February 2025 Gutter Cleaning','complete','none','2025-03-03T16:57:26.000Z','2025-07-31 19:20:42','in_1QycJ0HNec9XrT0FNw701J03',NULL,90000,'2025-03-10T16:58:52.000Z');
INSERT INTO jobs VALUES('fb37b4b1-a952-402f-a705-81e21ff40410','49.0','Gutter Cleaning',replace('Address:\n2333 Whiting Bay Courts NW\nKennesaw, GA  30152\nUnited States','\n',char(10)),'complete','none','2025-02-24T15:24:30.000Z','2025-07-31 19:20:42','in_1Qw3WEHNec9XrT0FFrzZANI8',NULL,22000,'2025-03-10T15:29:48.000Z');
INSERT INTO jobs VALUES('da4e445c-1bfe-44c7-8f58-c45779d086f8','27.0','Gutter Cleaning',replace('1111 Springdale Rd NE\nAtlanta GA 30306\nUnited States','\n',char(10)),'complete','none','2025-02-20T22:39:27.000Z','2025-07-31 19:20:42','in_1QuiOxHNec9XrT0FC1clo3gV',NULL,27000,'2025-03-23T00:23:44.000Z');
INSERT INTO jobs VALUES('af4f3323-2451-453d-860e-bb5437051768','5.0','Gutter Cleaning','Imported from Stripe Invoice #7-0054','complete','none','2025-02-14T15:44:36.000Z','2025-07-31 19:20:42','in_1QsR4CHNec9XrT0FSJVddKA6',NULL,16000,'2025-02-21T15:45:36.000Z');
INSERT INTO jobs VALUES('c57722c7-3294-4fe5-84b6-46ec263a4f16','6.0','Gutter Cleaning','Imported from Stripe Invoice #7-0053','complete','none','2025-02-05T20:39:23.000Z','2025-07-31 19:20:42','in_1QpFNXHNec9XrT0FI5zV0zz2',NULL,96000,'2025-02-19T20:53:27.000Z');
INSERT INTO jobs VALUES('45d94c1e-9df8-43f5-a1f5-7fe331fcaab7','29.0','Gutter Cleaning','Imported from Stripe Invoice #7-0052','complete','none','2025-02-05T20:34:53.000Z','2025-07-31 19:20:42','in_1QpFJBHNec9XrT0FneWrLiFm',NULL,60000,'2025-02-19T20:36:33.000Z');
INSERT INTO jobs VALUES('cf529550-a7bd-4395-9b46-c884934b0ac7','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0051','complete','none','2025-02-03T17:19:58.000Z','2025-07-31 19:20:42','in_1QoTJSHNec9XrT0Fw2VewAyw',NULL,90000,'2025-03-05T17:20:29.000Z');
INSERT INTO jobs VALUES('94d5802d-3ba2-4d23-bf72-730b602b9cc4','50.0','Gutter Cleaning','Imported from Stripe Invoice #7-0050','complete','none','2025-01-27T20:02:55.000Z','2025-07-31 19:20:43','in_1QlyWJHNec9XrT0FkiJi7HkP',NULL,17500,'2025-02-10T20:04:09.000Z');
INSERT INTO jobs VALUES('b3e17c4f-1e7f-4167-882e-56fc93eae5b3','7.0','Adhere Shingles Down','Imported from Stripe Invoice #7-0049','complete','none','2025-01-27T19:47:27.000Z','2025-07-31 19:20:43','in_1QlyHLHNec9XrT0F9FzZT0jT',NULL,20000,'2025-02-10T19:53:57.000Z');
INSERT INTO jobs VALUES('d16d6af9-2c4d-4564-aab1-39177d4f67f6','19.0','Gutter Cleaning','Imported from Stripe Invoice #7-0048','complete','none','2025-01-08T17:46:33.000Z','2025-07-31 19:20:43','in_1Qf3KvHNec9XrT0FgPtyHJYW',NULL,22000,'2025-01-22T17:48:25.000Z');
INSERT INTO jobs VALUES('8b172dbe-84cf-4f6f-9680-8beb44facbca','51.0','Gutter Cleaning','Imported from Stripe Invoice #7-0047','complete','none','2025-01-08T17:36:29.000Z','2025-07-31 19:20:43','in_1Qf3BBHNec9XrT0Fo15UNBps',NULL,18500,'2025-01-22T17:41:45.000Z');
INSERT INTO jobs VALUES('5ccb258b-fe42-44de-a3c6-7b6bc9d15b1d','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0046','complete','none','2024-12-31T20:06:30.000Z','2025-07-31 19:20:43','in_1QcBhyHNec9XrT0FszO2i1n1',NULL,90000,'2025-01-07T20:07:01.000Z');
INSERT INTO jobs VALUES('f0a11d7f-71db-4ddb-8dbd-d20ebe6f315c','8.0','Gutter Cleaning','Imported from Stripe Invoice #7-0045','complete','none','2024-12-17T18:27:31.000Z','2025-07-31 19:20:43','in_1QX5UVHNec9XrT0FFnJDt32P',NULL,20000,'2024-12-24T18:29:28.000Z');
INSERT INTO jobs VALUES('e0b1f4d5-6526-4f2f-9fa2-ad9a2bdbe7f9','52.0','Gutter & Guard Instal (1167)','Imported from Stripe Invoice #7-0044','complete','none','2024-12-14T19:47:46.000Z','2025-07-31 19:20:43','in_1QW1JWHNec9XrT0FC4qu3giO',NULL,47625,'2024-12-28T19:54:24.000Z');
INSERT INTO jobs VALUES('c1a01d2c-1b40-4f57-8549-ebb777400469','47.0','Gutter Cleaning','Imported from Stripe Invoice #7-0043','complete','none','2024-12-14T19:24:36.000Z','2025-07-31 19:20:44','in_1QW0x6HNec9XrT0F1IZ5sNRa',NULL,17500,'2024-12-28T19:27:15.000Z');
INSERT INTO jobs VALUES('1f457785-bafc-4a68-973e-1992920f58fe','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0042','complete','none','2024-12-02T16:15:59.000Z','2025-07-31 19:20:44','in_1QRcHzHNec9XrT0F4lEAWQFt',NULL,90000,'2024-12-09T16:18:10.000Z');
INSERT INTO jobs VALUES('7dff7d92-d6a5-4681-a121-918bcb99f63e','14.0','Install 6" Gutter','Imported from Stripe Invoice #7-0041','complete','none','2024-11-01T19:21:56.000Z','2025-07-31 19:20:44','in_1QGQPwHNec9XrT0FXArpmKuP',NULL,68000,'2024-11-15T19:24:08.000Z');
INSERT INTO jobs VALUES('c29a1696-c6e0-43b6-9208-fba8202aff7f','17.0','Caulk Vent Boot','Imported from Stripe Invoice #7-0040','complete','none','2024-11-01T19:17:51.000Z','2025-07-31 19:20:44','in_1QGQLzHNec9XrT0FpU5InZKA',NULL,95000,'2024-11-15T19:19:01.000Z');
INSERT INTO jobs VALUES('760b3d9d-6747-46b0-a2cb-b99afaff5dfb','11.0','Gutter Cleaning','Imported from Stripe Invoice #7-0039','complete','none','2024-10-29T14:38:24.000Z','2025-07-31 19:20:44','in_1QFGYuHNec9XrT0F8Zr8Q4AM',NULL,25000,'2024-11-05T14:39:19.000Z');
INSERT INTO jobs VALUES('4f735914-26b8-45bc-b716-0128701083ee','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0060','complete','none','2024-10-21T15:43:11.000Z','2025-07-31 19:20:44','in_1QCNlDHNec9XrT0Flgapvx9h',NULL,90000,'2025-04-01T22:27:08.000Z');
INSERT INTO jobs VALUES('ced7a897-814f-4598-a499-f62a45ac9225','21.0','Gutter Cleaning','Imported from Stripe Invoice #7-0033','complete','none','2024-10-21T15:40:34.000Z','2025-07-31 19:20:44','in_1QCNigHNec9XrT0FHKP9X9RG',NULL,39500,'2024-10-28T15:42:01.000Z');
INSERT INTO jobs VALUES('72bc53ae-a9c7-470d-9f50-4b8ac8da188c','14.0','Install 6" Gutter','Imported from Stripe Invoice #7-0032','complete','none','2024-10-21T15:32:36.000Z','2025-07-31 19:20:44','in_1QCNaxHNec9XrT0Fkl9Xs72a',NULL,78100,'2024-11-20T15:32:49.000Z');
INSERT INTO jobs VALUES('e7e42dce-aad9-4b00-a60b-8019b4df59c8','21.0','Replace Doorbell','Imported from Stripe Invoice #7-0035','complete','none','2024-10-06T01:29:25.000Z','2025-07-31 19:20:44','in_1Q6jHlHNec9XrT0FihMs98Xr',NULL,172600,'2024-11-04T15:42:38.000Z');
INSERT INTO jobs VALUES('2df0efd3-2922-40da-93d9-330e2a23f27f','21.0','Repair Siding','Imported from Stripe Invoice #7-0036','complete','none','2024-10-05T23:16:20.000Z','2025-07-31 19:20:45','in_1Q6hCyHNec9XrT0FRsplG5E3',NULL,130000,'2024-11-04T15:42:54.000Z');
INSERT INTO jobs VALUES('480e0241-219f-4d2d-acee-d285bce53013','17.0','September Gutter Cleaning','Imported from Stripe Invoice #7-0029','complete','none','2024-10-01T14:02:17.000Z','2025-07-31 19:20:45','in_1Q56ecHNec9XrT0FOxKlFdPi',NULL,90000,'2024-10-15T14:03:51.000Z');
INSERT INTO jobs VALUES('e171c460-c2df-4b67-88cb-a38afc8a084a','14.0','Roof Wash','Imported from Stripe Invoice #7-0027','complete','none','2024-09-06T17:41:30.000Z','2025-07-31 19:20:45','in_1Pw6A2HNec9XrT0FLJaHfVaf',NULL,45500,'2024-10-06T17:41:52.000Z');
INSERT INTO jobs VALUES('f73dc67f-ad56-42e3-8a84-7814033577e8','25.0','Pressure Wash Porch & Foyer 1/3','Imported from Stripe Invoice #7-0028','complete','none','2024-08-28T13:56:55.000Z','2025-07-31 19:20:45','in_1PsmMlHNec9XrT0FEcSWfPMF',NULL,229166,'2024-09-30T17:44:40.000Z');
INSERT INTO jobs VALUES('c5158643-a2c2-4a32-a53d-311ff9397ee4','17.0','Gutter Cleaning','Imported from Stripe Invoice #7-0026','complete','none','2024-08-28T13:37:53.000Z','2025-07-31 19:20:45','in_1Psm4LHNec9XrT0F3EbyTAWl',NULL,90000,'2024-09-27T13:39:06.000Z');
INSERT INTO jobs VALUES('bcae94d3-48d1-4331-8769-671ca97fc26d','21.0','Roof Repair','Imported from Stripe Invoice #7-0025','complete','none','2024-08-15T14:25:00.000Z','2025-07-31 19:20:45','in_1Po4boHNec9XrT0FG2vNw5pp',NULL,35000,'2024-09-14T14:25:13.000Z');
INSERT INTO jobs VALUES('d31b4d4a-e8d2-42b9-b71d-a9f3972f15e0','21.0','Roof Repair','Imported from Stripe Invoice #7-0024','complete','none','2024-08-02T21:52:00.000Z','2025-07-31 19:20:45','in_1PjTOGHNec9XrT0FqhLRU7Fm',NULL,23000,'2024-09-01T21:55:27.000Z');
INSERT INTO jobs VALUES('5a2c5ba7-e714-4746-b264-942112ada975','16.0','Gutter Cleaning','Imported from Stripe Invoice #7-0023','complete','none','2024-08-02T21:04:15.000Z','2025-07-31 19:20:45','in_1PjSe3HNec9XrT0FJ6GTNuHa',NULL,16500,'2024-08-09T21:50:50.000Z');
INSERT INTO jobs VALUES('a957f448-8c0d-46b9-b8ee-1ac8a8e82e6a','17.0','July Gutter Cleaning (Sullivan)','Imported from Stripe Invoice #7-0022','complete','none','2024-07-31T23:16:38.000Z','2025-07-31 19:20:46','in_1Pill4HNec9XrT0FcQWRN7tw',NULL,90000,'2024-08-30T23:26:37.000Z');
INSERT INTO jobs VALUES('c304ec44-e3f5-41c6-9b43-a85139c9d019','21.0','Roof Repair','Imported from Stripe Invoice #7-0021','complete','none','2024-07-28T03:10:02.000Z','2025-07-31 19:20:46','in_1PhNUkHNec9XrT0FkJtpg5SF',NULL,26500,'2024-08-04T12:01:01.000Z');
INSERT INTO jobs VALUES('386aeaa3-ab1d-404a-897d-a71a91ca728d','19.0','Gutter Cleaning','Imported from Stripe Invoice #7-0020','complete','none','2024-07-26T16:25:06.000Z','2025-07-31 19:20:46','in_1Pgqx4HNec9XrT0FR1IxXBCw',NULL,20500,'2024-08-02T16:55:29.000Z');
INSERT INTO jobs VALUES('41d6c1a8-e819-473c-80da-0bce1843ce94','53.0','Pressure Wash Fire Ring','Imported from Stripe Invoice #7-0019','complete','none','2024-07-24T01:05:55.000Z','2025-07-31 19:20:46','in_1PfteRHNec9XrT0FHXwOdwTw',NULL,74125,'2024-07-31T01:11:14.000Z');
INSERT INTO jobs VALUES('8173e7cd-a26e-4378-96a2-520fe25dbaf4','54.0','Pressure Wash House','Imported from Stripe Invoice #7-0018','complete','none','2024-07-19T23:25:35.000Z','2025-07-31 19:20:46','in_1PeQB9HNec9XrT0FdGs4rnQ8',NULL,67500,'2024-07-27T17:06:10.000Z');
INSERT INTO jobs VALUES('3416cf6f-042c-4944-9ff4-eb3964a25e77','21.0','Roof Repair','Imported from Stripe Invoice #7-0017','complete','none','2024-07-19T23:20:05.000Z','2025-07-31 19:20:46','in_1PeQ5pHNec9XrT0Fdh4Q3tdx',NULL,21500,'2024-07-26T23:22:40.000Z');
INSERT INTO jobs VALUES('4807dc5f-6e00-4195-9d39-cf2554579775','21.0','Gutter Cleaning','Imported from Stripe Invoice #7-0016','complete','none','2024-07-19T23:19:21.000Z','2025-07-31 19:20:46','in_1PeQ57HNec9XrT0F7ds5yKob',NULL,15000,'2024-07-26T23:19:53.000Z');
INSERT INTO jobs VALUES('7df993df-4261-4356-a219-3ceb0821f3dd','21.0','Roof Repair','Imported from Stripe Invoice #7-0015','complete','none','2024-07-19T23:18:26.000Z','2025-07-31 19:20:46','in_1PeQ4EHNec9XrT0FXlsWuqKy',NULL,34500,'2024-07-26T23:18:59.000Z');
INSERT INTO jobs VALUES('e7caa985-c4be-45f8-826b-27a9133ee3d0','21.0','Gutter Repair','Imported from Stripe Invoice #7-0014','complete','none','2024-07-19T23:17:14.000Z','2025-07-31 19:20:46','in_1PeQ34HNec9XrT0F5uJsQRde',NULL,9500,'2024-07-26T23:17:53.000Z');
INSERT INTO jobs VALUES('c16f1ebe-39f0-4bbd-96ab-ffe29bccdaa7','21.0','Trim Trees off Chimney','Imported from Stripe Invoice #7-0012','complete','none','2024-07-19T23:14:28.000Z','2025-07-31 19:20:47','in_1PeQ0OHNec9XrT0FPlrueyOw',NULL,30000,'2024-07-26T23:14:42.000Z');
INSERT INTO jobs VALUES('0d519900-fa84-475f-acba-38632dc95f1f','47.0','Pressure Wash','Imported from Stripe Invoice #7-0008','complete','none','2024-07-19T22:57:01.000Z','2025-07-31 19:20:47','in_1PePjVHNec9XrT0FNBWDmU6z',NULL,9000,'2024-07-26T22:57:29.000Z');
INSERT INTO jobs VALUES('2bb5e0fd-edbf-4449-bbd1-2870c647d707','22.0','Gutter Cleaning','Imported from Stripe Invoice #7-0007','complete','none','2024-07-19T22:47:16.000Z','2025-07-31 19:20:47','in_1PePa4HNec9XrT0F7l8RypVu',NULL,19000,'2024-07-26T22:48:18.000Z');
INSERT INTO jobs VALUES('50015b11-c160-4f37-a083-a507729259e9','26.0','Roof Wash','Imported from Stripe Invoice #7-0006','complete','none','2024-07-13T14:24:24.000Z','2025-07-31 19:20:47','in_1Pc6s8HNec9XrT0FqOqeKwQI',NULL,75000,'2024-07-20T14:24:54.000Z');
INSERT INTO jobs VALUES('74152634-81e4-466e-a24c-4eb0efa4aee9','27.0','Pressure Wash House','Imported from Stripe Invoice #7-0005','complete','none','2024-07-03T21:37:45.000Z','2025-07-31 19:20:47','in_1PYas1HNec9XrT0FEOq3ALv9',NULL,57500,'2024-07-10T21:38:13.000Z');
INSERT INTO jobs VALUES('a753e4cc-213c-4bb7-bb21-5680d9346ac1','25.0','Pressure Wash Porch & Foyer (1/3)','Imported from Stripe Invoice #7-0004','complete','none','2024-06-26T17:01:54.000Z','2025-07-31 19:20:47','in_1PVzEEHNec9XrT0FkQ1IuD5L',NULL,458332,'2024-07-03T17:05:29.000Z');
INSERT INTO jobs VALUES('3c0040d3-b6ef-49b9-9c72-4b3cb99599a5','28.0','Refinish, Caulk, & Paint Back Doors (2 French Doors)','Imported from Stripe Invoice #7-0003','complete','none','2024-06-11T16:00:16.000Z','2025-07-31 19:20:47','in_1PQX7MHNec9XrT0F0KZlFUB4',NULL,320000,'2024-06-18T16:11:32.000Z');
INSERT INTO jobs VALUES('2bdb5bbc-1346-4e5b-bc71-7a73a027ffd3','30.0','Roof Repair ','Imported from Stripe Invoice #7-0002','complete','none','2024-06-03T13:53:35.000Z','2025-07-31 19:20:47','in_1PNbKNHNec9XrT0Fog2sjenK',NULL,35000,'2024-06-10T13:54:31.000Z');
INSERT INTO jobs VALUES('7581ed85-9de8-4f78-98b4-d32edf2a34b1','31.0','Gutter Cleaning','Imported from Stripe Invoice #7-0001','complete','none','2024-05-28T14:36:35.000Z','2025-07-31 19:20:48','in_1PLR8hHNec9XrT0F8lH215Qr',NULL,18000,'2024-06-04T14:46:19.000Z');
CREATE TABLE line_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  job_id TEXT,
  description TEXT,
  unit_total_amount_cents INTEGER, quantity INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
);
INSERT INTO line_items VALUES(1,'34f97039-8469-420e-8ce2-b04aec997266','Roof Wash',45500,1);
INSERT INTO line_items VALUES(2,'7d09d3c0-35eb-4f02-9382-e29f762e3fd2','Roof Repair',16500,1);
INSERT INTO line_items VALUES(3,'7d09d3c0-35eb-4f02-9382-e29f762e3fd2','Gutter Replacement',18500,1);
INSERT INTO line_items VALUES(4,'e905c6b6-7fe0-40d9-9b91-e90114775982','Roof Wash',64500,1);
INSERT INTO line_items VALUES(5,'e905c6b6-7fe0-40d9-9b91-e90114775982','Gutter Cleaning & Wash',10500,1);
INSERT INTO line_items VALUES(6,'bbebb071-0d75-44a3-bbb9-63f5a474e534','Pressure Wash House',57500,1);
INSERT INTO line_items VALUES(7,'139094ef-febd-4fed-9e75-8d60d61890b0','Repair Broken Joist',100,1);
INSERT INTO line_items VALUES(8,'1fc2e435-9285-401a-99c7-ba3496725667','Pressure Wash Walkways & Pool Area',25000,1);
INSERT INTO line_items VALUES(9,'6b648b9a-b0ba-42fd-bcc8-7a3e1691c5f7','Gutter Cleaning **',8000,1);
INSERT INTO line_items VALUES(10,'6b648b9a-b0ba-42fd-bcc8-7a3e1691c5f7','Re-secure Detached Downspout **',3000,1);
INSERT INTO line_items VALUES(11,'6b648b9a-b0ba-42fd-bcc8-7a3e1691c5f7','Re-secure Loose Gutters **',3500,1);
INSERT INTO line_items VALUES(12,'6b648b9a-b0ba-42fd-bcc8-7a3e1691c5f7','Pressure Wash House **',20000,1);
INSERT INTO line_items VALUES(13,'6b648b9a-b0ba-42fd-bcc8-7a3e1691c5f7','Pressure Wash Walkway & Street ^^',19500,1);
INSERT INTO line_items VALUES(14,'6b648b9a-b0ba-42fd-bcc8-7a3e1691c5f7','Scrape & Clean Windows ^^',15000,1);
INSERT INTO line_items VALUES(15,'3b43428b-0226-46ff-9dc9-2da27861995a','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(16,'c68f70b8-5b64-495f-bb84-e3c38643a1dc','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(17,'5c01368b-6c04-43ac-a46b-ad2575d2a6b9','Gutter Cleaning',18000,1);
INSERT INTO line_items VALUES(18,'6fca4366-79d7-492d-8b7e-a45710da4474','Clean Skylights',2000,1);
INSERT INTO line_items VALUES(19,'6fca4366-79d7-492d-8b7e-a45710da4474','Gutter Cleaning',17500,1);
INSERT INTO line_items VALUES(20,'ee68fba6-594b-4d47-8d5b-774ed67fc37d','Gutter Cleaning',19500,1);
INSERT INTO line_items VALUES(21,'df168945-037e-4872-a00e-2d32bf8a04ac','Roof Repair',18000,1);
INSERT INTO line_items VALUES(22,'f993ac96-21e6-49ea-8aaf-9bf8e62548e2','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(23,'eca713a2-7ac3-4e45-a4b4-66a2889cff11','Gutter Cleaning',18000,1);
INSERT INTO line_items VALUES(24,'25a85364-62ff-4be8-ba5e-555634247dbe','Gutter Cleaning',18500,1);
INSERT INTO line_items VALUES(25,'2d90ede2-dd3c-43d2-af78-e42d447beb8c','Add Open Valley Flashing (2) Valleys',110000,1);
INSERT INTO line_items VALUES(26,'2d90ede2-dd3c-43d2-af78-e42d447beb8c','Add Gable Flashing (whole house)',60000,1);
INSERT INTO line_items VALUES(27,'2d90ede2-dd3c-43d2-af78-e42d447beb8c','Add Ridge Flashing',12500,1);
INSERT INTO line_items VALUES(28,'2d90ede2-dd3c-43d2-af78-e42d447beb8c','Replace Roof Sheathing',60000,1);
INSERT INTO line_items VALUES(29,'2d90ede2-dd3c-43d2-af78-e42d447beb8c','Replace Drip Edge',0,1);
INSERT INTO line_items VALUES(30,'2d90ede2-dd3c-43d2-af78-e42d447beb8c','Add 2" Lift to Valley Rafters',30000,1);
INSERT INTO line_items VALUES(31,'2d90ede2-dd3c-43d2-af78-e42d447beb8c','Labor- Removing Additional Layers of Shingles',20000,1);
INSERT INTO line_items VALUES(32,'1b943e86-14b4-4469-8e02-630554a357cd','Pressure Wash House & Back Patio',45000,1);
INSERT INTO line_items VALUES(33,'ee18d68a-67ed-4a18-b4a9-4555bd3890e8','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(34,'fb37b4b1-a952-402f-a705-81e21ff40410','Gutter Cleaning',22000,1);
INSERT INTO line_items VALUES(35,'da4e445c-1bfe-44c7-8f58-c45779d086f8','Gutter Cleaning',27000,1);
INSERT INTO line_items VALUES(36,'af4f3323-2451-453d-860e-bb5437051768','Gutter Cleaning',16000,1);
INSERT INTO line_items VALUES(37,'c57722c7-3294-4fe5-84b6-46ec263a4f16','Gutter Cleaning',96000,6);
INSERT INTO line_items VALUES(38,'45d94c1e-9df8-43f5-a1f5-7fe331fcaab7','Gutter Cleaning',15000,1);
INSERT INTO line_items VALUES(39,'45d94c1e-9df8-43f5-a1f5-7fe331fcaab7','Roof/Chimney Siding Repair',20000,1);
INSERT INTO line_items VALUES(40,'45d94c1e-9df8-43f5-a1f5-7fe331fcaab7','Pressure Wash Driveway',25000,1);
INSERT INTO line_items VALUES(41,'cf529550-a7bd-4395-9b46-c884934b0ac7','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(42,'94d5802d-3ba2-4d23-bf72-730b602b9cc4','Gutter Cleaning',17500,1);
INSERT INTO line_items VALUES(43,'b3e17c4f-1e7f-4167-882e-56fc93eae5b3','Adhere Shingles Down',5000,1);
INSERT INTO line_items VALUES(44,'b3e17c4f-1e7f-4167-882e-56fc93eae5b3','Trim Branches',15000,1);
INSERT INTO line_items VALUES(45,'d16d6af9-2c4d-4564-aab1-39177d4f67f6','Gutter Cleaning',22000,1);
INSERT INTO line_items VALUES(46,'8b172dbe-84cf-4f6f-9680-8beb44facbca','Gutter Cleaning',18500,1);
INSERT INTO line_items VALUES(47,'5ccb258b-fe42-44de-a3c6-7b6bc9d15b1d','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(48,'f0a11d7f-71db-4ddb-8dbd-d20ebe6f315c','Gutter Cleaning',20000,1);
INSERT INTO line_items VALUES(49,'e0b1f4d5-6526-4f2f-9fa2-ad9a2bdbe7f9','Gutter & Guard Instal (1167)',45000,1);
INSERT INTO line_items VALUES(50,'e0b1f4d5-6526-4f2f-9fa2-ad9a2bdbe7f9','Gutter Cleaning (1162)',17500,1);
INSERT INTO line_items VALUES(51,'c1a01d2c-1b40-4f57-8549-ebb777400469','Gutter Cleaning',17500,1);
INSERT INTO line_items VALUES(52,'1f457785-bafc-4a68-973e-1992920f58fe','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(53,'7dff7d92-d6a5-4681-a121-918bcb99f63e','Install 6" Gutter',68000,1);
INSERT INTO line_items VALUES(54,'c29a1696-c6e0-43b6-9208-fba8202aff7f','Caulk Vent Boot',5000,1);
INSERT INTO line_items VALUES(55,'c29a1696-c6e0-43b6-9208-fba8202aff7f','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(56,'760b3d9d-6747-46b0-a2cb-b99afaff5dfb','Gutter Cleaning',25000,1);
INSERT INTO line_items VALUES(57,'4f735914-26b8-45bc-b716-0128701083ee','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(58,'ced7a897-814f-4598-a499-f62a45ac9225','Gutter Cleaning',14500,1);
INSERT INTO line_items VALUES(59,'ced7a897-814f-4598-a499-f62a45ac9225','Tree Removal',25000,1);
INSERT INTO line_items VALUES(60,'72bc53ae-a9c7-470d-9f50-4b8ac8da188c','Install 6" Gutter',78100,1);
INSERT INTO line_items VALUES(61,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Replace Doorbell',1500,1);
INSERT INTO line_items VALUES(62,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Replace Light Fixture',3000,1);
INSERT INTO line_items VALUES(63,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Repair Doors & Hinges',2100,3);
INSERT INTO line_items VALUES(64,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Replace Mirrors',3500,1);
INSERT INTO line_items VALUES(65,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Drywall Repairs',50000,1);
INSERT INTO line_items VALUES(66,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Paint Material',27500,1);
INSERT INTO line_items VALUES(67,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Gutter Repair',1000,1);
INSERT INTO line_items VALUES(68,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Roof Repair',36500,1);
INSERT INTO line_items VALUES(69,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Replace Subfloor',47500,1);
INSERT INTO line_items VALUES(70,'e7e42dce-aad9-4b00-a60b-8019b4df59c8','Paint Interior',0,1);
INSERT INTO line_items VALUES(71,'2df0efd3-2922-40da-93d9-330e2a23f27f','Repair Siding',0,1);
INSERT INTO line_items VALUES(72,'2df0efd3-2922-40da-93d9-330e2a23f27f','Install Base and Shoe Moulding',50000,1);
INSERT INTO line_items VALUES(73,'2df0efd3-2922-40da-93d9-330e2a23f27f','Install 6" Gutter',80000,1);
INSERT INTO line_items VALUES(74,'480e0241-219f-4d2d-acee-d285bce53013','September Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(75,'e171c460-c2df-4b67-88cb-a38afc8a084a','Roof Wash',45500,1);
INSERT INTO line_items VALUES(76,'f73dc67f-ad56-42e3-8a84-7814033577e8','Pressure Wash Porch & Foyer 1/3',229166,1);
INSERT INTO line_items VALUES(77,'c5158643-a2c2-4a32-a53d-311ff9397ee4','Gutter Cleaning',90000,1);
INSERT INTO line_items VALUES(78,'bcae94d3-48d1-4331-8769-671ca97fc26d','Roof Repair',16500,1);
INSERT INTO line_items VALUES(79,'bcae94d3-48d1-4331-8769-671ca97fc26d','Gutter Replacement',18500,1);
INSERT INTO line_items VALUES(80,'d31b4d4a-e8d2-42b9-b71d-a9f3972f15e0','Roof Repair',23000,1);
INSERT INTO line_items VALUES(81,'5a2c5ba7-e714-4746-b264-942112ada975','Gutter Cleaning',16500,1);
INSERT INTO line_items VALUES(82,'a957f448-8c0d-46b9-b8ee-1ac8a8e82e6a','July Gutter Cleaning (Sullivan)',90000,1);
INSERT INTO line_items VALUES(83,'c304ec44-e3f5-41c6-9b43-a85139c9d019','Roof Repair',26500,1);
INSERT INTO line_items VALUES(84,'386aeaa3-ab1d-404a-897d-a71a91ca728d','Gutter Cleaning',20500,1);
INSERT INTO line_items VALUES(85,'41d6c1a8-e819-473c-80da-0bce1843ce94','Pressure Wash Fire Ring',7500,1);
INSERT INTO line_items VALUES(86,'41d6c1a8-e819-473c-80da-0bce1843ce94','Pressure Wash Whole House',73000,2);
INSERT INTO line_items VALUES(87,'8173e7cd-a26e-4378-96a2-520fe25dbaf4','Pressure Wash House',67500,1);
INSERT INTO line_items VALUES(88,'3416cf6f-042c-4944-9ff4-eb3964a25e77','Roof Repair',21500,1);
INSERT INTO line_items VALUES(89,'4807dc5f-6e00-4195-9d39-cf2554579775','Gutter Cleaning',15000,1);
INSERT INTO line_items VALUES(90,'7df993df-4261-4356-a219-3ceb0821f3dd','Roof Repair',34500,1);
INSERT INTO line_items VALUES(91,'e7caa985-c4be-45f8-826b-27a9133ee3d0','Gutter Repair',9500,1);
INSERT INTO line_items VALUES(92,'c16f1ebe-39f0-4bbd-96ab-ffe29bccdaa7','Trim Trees off Chimney',15000,1);
INSERT INTO line_items VALUES(93,'c16f1ebe-39f0-4bbd-96ab-ffe29bccdaa7','Gutter Cleaning',15000,1);
INSERT INTO line_items VALUES(94,'0d519900-fa84-475f-acba-38632dc95f1f','Pressure Wash',9000,1);
INSERT INTO line_items VALUES(95,'2bb5e0fd-edbf-4449-bbd1-2870c647d707','Gutter Cleaning',19000,1);
INSERT INTO line_items VALUES(96,'50015b11-c160-4f37-a083-a507729259e9','Roof Wash',64500,1);
INSERT INTO line_items VALUES(97,'50015b11-c160-4f37-a083-a507729259e9','Gutter Cleaning & Wash',10500,1);
INSERT INTO line_items VALUES(98,'74152634-81e4-466e-a24c-4eb0efa4aee9','Pressure Wash House',57500,1);
INSERT INTO line_items VALUES(99,'a753e4cc-213c-4bb7-bb21-5680d9346ac1','Pressure Wash Porch & Foyer (1/3)',458332,2);
INSERT INTO line_items VALUES(100,'3c0040d3-b6ef-49b9-9c72-4b3cb99599a5','Refinish, Caulk, & Paint Back Doors (2 French Doors)',75000,1);
INSERT INTO line_items VALUES(101,'3c0040d3-b6ef-49b9-9c72-4b3cb99599a5','Paint & Caulk Fascia, Soffit, Trim, Siding, Frames, Gutters, Downspouts & Windows',355000,1);
INSERT INTO line_items VALUES(102,'3c0040d3-b6ef-49b9-9c72-4b3cb99599a5','Replace (7) Fascia Boards & (3) Soffit Pieces',130500,1);
INSERT INTO line_items VALUES(103,'3c0040d3-b6ef-49b9-9c72-4b3cb99599a5','Replace Wood Trim on Windows with Hardi Plank Trim',34500,1);
INSERT INTO line_items VALUES(104,'3c0040d3-b6ef-49b9-9c72-4b3cb99599a5','Replace (4) Walls of Siding on Windows, Replace (2) Walls of Siding on 2nd Story',125000,1);
INSERT INTO line_items VALUES(105,'2bdb5bbc-1346-4e5b-bc71-7a73a027ffd3','Roof Repair ',35000,1);
INSERT INTO line_items VALUES(106,'7581ed85-9de8-4f78-98b4-d32edf2a34b1','Gutter Cleaning',18000,1);
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
INSERT INTO sqlite_sequence VALUES('d1_migrations',2);
INSERT INTO sqlite_sequence VALUES('users',54);
INSERT INTO sqlite_sequence VALUES('password_reset_tokens',2);
INSERT INTO sqlite_sequence VALUES('line_items',106);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_line_items_job_id ON line_items(job_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_job_recurrence_requests_job_id ON job_recurrence_requests(job_id);
CREATE INDEX idx_job_recurrence_requests_status ON job_recurrence_requests(status);
CREATE INDEX idx_calendar_tokens_user_id ON calendar_tokens(user_id);
