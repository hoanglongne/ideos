-- Tổng dung lượng dữ liệu của mỗi kho, để đặt trần mà không phải quét cả bảng mỗi lần ghi.
ALTER TABLE vaults ADD COLUMN bytes INTEGER NOT NULL DEFAULT 0;

-- Kho đã có từ trước: tính một lần cho đúng
UPDATE vaults SET bytes =
  COALESCE((SELECT SUM(LENGTH(data)) FROM ideas WHERE ideas.vault = vaults.id), 0) +
  COALESCE((SELECT SUM(LENGTH(meta)) FROM attachments WHERE attachments.vault = vaults.id), 0) +
  COALESCE((SELECT SUM(LENGTH(data)) FROM blobs WHERE blobs.vault = vaults.id), 0);
