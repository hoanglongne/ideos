-- Ideos sync: mỗi "vault" là dữ liệu của một người, xác định bằng mã đồng bộ.
-- Máy chủ chỉ giữ dữ liệu đã mã hoá; nó không có khoá để đọc.

CREATE TABLE vaults (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  seq INTEGER NOT NULL DEFAULT 0, -- tăng mỗi lần ghi, làm con trỏ kéo về
  created_at INTEGER NOT NULL
);

CREATE TABLE ideas (
  vault TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT, -- JSON đã mã hoá (base64), NULL khi đã xoá
  updated_at INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  PRIMARY KEY (vault, id)
);
CREATE INDEX ideas_pull ON ideas (vault, seq);

CREATE TABLE attachments (
  vault TEXT NOT NULL,
  id TEXT NOT NULL,
  meta TEXT, -- loại, mime, thời lượng… đã mã hoá
  deleted INTEGER NOT NULL DEFAULT 0,
  seq INTEGER NOT NULL,
  PRIMARY KEY (vault, id)
);
CREATE INDEX attachments_pull ON attachments (vault, seq);

-- Ảnh và ghi âm (đã mã hoá), cắt thành phần 1 MB vì D1 giới hạn 2 MB mỗi dòng
CREATE TABLE blobs (
  vault TEXT NOT NULL,
  id TEXT NOT NULL,
  part INTEGER NOT NULL,
  data BLOB NOT NULL,
  PRIMARY KEY (vault, id, part)
);
