
-- Settings

DELETE FROM `top`, `toc`, `to` USING `sys_options_types` AS `top` LEFT JOIN `sys_options_categories` AS `toc` ON `top`.`id`=`toc`.`type_id` LEFT JOIN `sys_options` AS `to` ON `toc`.`id`=`to`.`category_id` WHERE `top`.`name` = 'bx_mobileapps';

-- Injections

DELETE FROM `sys_injections` WHERE `name` IN('bx_mobileapps');

-- Alerts

SET @iHandlerId := (SELECT `id` FROM `sys_alerts_handlers` WHERE `name` = 'bx_mobileapps');

DELETE FROM `sys_alerts_handlers` WHERE `id`  = @iHandlerId;
DELETE FROM `sys_alerts` WHERE `handler_id` =  @iHandlerId ;
