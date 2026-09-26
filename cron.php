<?php
// cron: */10 * * * * php /path/to/backend/cron.php >> /path/to/backend/cron.log 2>&1
require __DIR__.'/common.php';
$r=collect(); echo '['.gmdate('c').'] '.json_encode($r,JSON_UNESCAPED_UNICODE).PHP_EOL;
