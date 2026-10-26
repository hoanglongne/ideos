-- Đếm số lần gọi AI mỗi ngày cho từng mã đồng bộ, để không vượt hạn mức miễn phí của Workers AI.
CREATE TABLE ai_usage (
  vault TEXT NOT NULL,
  day TEXT NOT NULL, -- YYYY-MM-DD theo giờ UTC, trùng lúc Cloudflare reset hạn mức
  n INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (vault, day)
);
