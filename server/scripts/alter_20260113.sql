-- 追加user_id字段
ALTER TABLE note ADD COLUMN user_id INT NOT NULL;
-- 将所有数据归到当前用户(48)下
UPDATE note SET user_id = 48;
-- 添加外键约束
ALTER TABLE note ADD FOREIGN KEY (user_id) REFERENCES user (id);

-- 和上面相同
ALTER TABLE workspace ADD COLUMN user_id INT NOT NULL;

UPDATE workspace SET user_id = 48;

ALTER TABLE workspace ADD FOREIGN KEY (user_id) REFERENCES user (id);
-- 去掉 workspace 表 title 字段的唯一性约束
ALTER TABLE workspace DROP INDEX title;