<?php
require __DIR__.'/common.php';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Headers: X-API-Token, Content-Type');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') { http_response_code(204); exit; }
$c=cfg(); if($c['api_token']!=='' && ($_SERVER['HTTP_X_API_TOKEN']??'')!==$c['api_token']){http_response_code(403);echo json_encode(['ok'=>false,'error'=>'forbidden'],JSON_UNESCAPED_UNICODE);exit;}
$a=$_GET['action']??'status'; try{
 if($a==='ranking'){
   $pc=(int)db()->query('SELECT COUNT(*) FROM players')->fetchColumn();
   if($pc===0){ try { collect(80); } catch(Throwable $ignore){} }
   echo json_encode(['ok'=>true,'rows'=>ranking_rows($_GET['metric']??'games',$_GET['period']??'all')],JSON_UNESCAPED_UNICODE);
 }
 elseif($a==='search'){
   $q=[];
   foreach(['name','trip','room_name','jobset','s_date','e_date','totsushi','one_night','word_wolf'] as $k){ if(isset($_GET[$k]) && $_GET[$k]!=='') $q[$k]=$_GET[$k]; }
   if(!isset($q['name']) && !isset($q['trip'])){ throw new Exception('name または trip を指定してください'); }
   $base=$c['log_api_base']; $url=$base.'?'.http_build_query($q,'','&',PHP_QUERY_RFC3986);
   $raw=http_get($url); if($raw===null) throw new Exception('ログ検索APIに接続できません');
   $j=json_decode($raw,true); if(!is_array($j)) throw new Exception('ログ検索APIのJSONを解釈できません');
   echo json_encode(['ok'=>true,'source'=>$url,'data'=>$j],JSON_UNESCAPED_UNICODE);
 }
 elseif($a==='sync'){ $r=collect((int)($_GET['limit']??0)); $snap=snapshot(); echo json_encode(['ok'=>true,'sync'=>$r,'players'=>stats_players(),'snapshot'=>$snap],JSON_UNESCAPED_UNICODE); }
 elseif($a==='players'){ echo json_encode(['ok'=>true,'players'=>stats_players(trim($_GET['q']??''))],JSON_UNESCAPED_UNICODE); }
 elseif($a==='games'){ $s=db()->query('SELECT id,room_name,game_date,winner_side,fetched_at FROM games ORDER BY fetched_at DESC LIMIT 200'); echo json_encode(['ok'=>true,'games'=>$s->fetchAll()],JSON_UNESCAPED_UNICODE); }
 else { $p=(int)db()->query('SELECT COUNT(*) FROM players')->fetchColumn();$g=(int)db()->query('SELECT COUNT(*) FROM games')->fetchColumn();echo json_encode(['ok'=>true,'players'=>$p,'games'=>$g,'time'=>gmdate('c')],JSON_UNESCAPED_UNICODE); }
}catch(Throwable $e){http_response_code(500);echo json_encode(['ok'=>false,'error'=>$e->getMessage()],JSON_UNESCAPED_UNICODE);}
