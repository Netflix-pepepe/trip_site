<?php
require __DIR__.'/common.php';
header('Content-Type: application/json; charset=utf-8');
$c=cfg(); if($c['api_token']!=='' && ($_SERVER['HTTP_X_API_TOKEN']??'')!==$c['api_token']){http_response_code(403);echo json_encode(['ok'=>false,'error'=>'forbidden'],JSON_UNESCAPED_UNICODE);exit;}
$a=$_GET['action']??'status'; try{
 if($a==='sync'){ $r=collect((int)($_GET['limit']??0)); $snap=snapshot(); echo json_encode(['ok'=>true,'sync'=>$r,'players'=>stats_players(),'snapshot'=>$snap],JSON_UNESCAPED_UNICODE); }
 elseif($a==='players'){ echo json_encode(['ok'=>true,'players'=>stats_players(trim($_GET['q']??''))],JSON_UNESCAPED_UNICODE); }
 elseif($a==='games'){ $s=db()->query('SELECT id,room_name,game_date,winner_side,fetched_at FROM games ORDER BY fetched_at DESC LIMIT 200'); echo json_encode(['ok'=>true,'games'=>$s->fetchAll()],JSON_UNESCAPED_UNICODE); }
 else { $p=(int)db()->query('SELECT COUNT(*) FROM players')->fetchColumn();$g=(int)db()->query('SELECT COUNT(*) FROM games')->fetchColumn();echo json_encode(['ok'=>true,'players'=>$p,'games'=>$g,'time'=>gmdate('c')],JSON_UNESCAPED_UNICODE); }
}catch(Throwable $e){http_response_code(500);echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);}
