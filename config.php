<?php
return [
  'db' => __DIR__ . '/zinro.sqlite',
  'base_url' => 'https://zinro.net/m/',
  'user_agent' => 'WolfOnline-Stats-Collector/1.0 (+your-site-contact)',
  'max_rooms_per_run' => 80,
  'request_delay_us' => 250000,
  'request_timeout' => 15,
  'api_token' => '', // 任意。設定するとAPI操作にトークンが必要
];
