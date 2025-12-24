-- 2024-12-24 마이그레이션
-- 썸네일 및 갤러리 표시 기능 추가

-- 1. post_attachments 테이블에 thumbnailPath 컬럼 추가
ALTER TABLE `post_attachments`
ADD COLUMN `thumbnailPath` VARCHAR(500) NULL AFTER `sortOrder`;

-- 2. boards 테이블에 displayType 컬럼 추가 (list 또는 gallery)
ALTER TABLE `boards`
ADD COLUMN `displayType` VARCHAR(20) NOT NULL DEFAULT 'list' AFTER `sortOrder`;
