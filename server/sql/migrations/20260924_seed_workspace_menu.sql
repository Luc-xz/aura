-- Workbench menu entry (B6). Idempotent; run after 20260903_rbac_menu_as_permission.sql
-- on databases seeded before B6. Fresh installs get the same rows from init.sql.
-- sort_order 0 places 工作台 before Chat (sort_order 1); front-end navigation is menu-driven.
INSERT IGNORE INTO menu (id, parent_id, name, code, permission, path, icon, sort_order, type, visible) VALUES
(2, NULL, '工作台', 'workspace', NULL, '/workspace', 'AppstoreFilled', 0, 'menu', 1);

-- member/admin gain the entry explicitly; super_admin is granted all menus by policy,
-- the extra row only materializes that grant for databases seeded before B6.
INSERT IGNORE INTO role_menu (role_id, menu_id)
SELECT r.id, 2 FROM role r WHERE r.code IN ('member', 'admin', 'super_admin');
