-- 为 asset 增加内容 hash，用于相同文件在存储层全局去重（相同内容只存一份，复用 file_url）。
-- content_hash 为上传文件（处理/压缩后最终字节）的 SHA-256 十六进制串；link/text/anchor 等无文件类型为 NULL。
ALTER TABLE public.asset ADD COLUMN IF NOT EXISTS content_hash text;
CREATE INDEX IF NOT EXISTS asset_content_hash_idx ON public.asset(content_hash);
