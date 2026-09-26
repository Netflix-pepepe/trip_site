<?php
function cfg(){ static $c; return $c ??= require __DIR__.'/config.php'; }
function db(){ static $pdo; if($pdo) return $pdo; $c=cfg(); $pdo=new PDO('sqlite:'.$c['db'],null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); $pdo->exec(file_get_contents(__DIR__.'/schema.sql')); return $pdo; }
function http_get($url){ $c=cfg(); $ch=curl_init($url); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_CONNECTTIMEOUT=>$c['request_timeout'],CURLOPT_TIMEOUT=>$c['request_timeout'],CURLOPT_USERAGENT=>$c['user_agent'],CURLOPT_ENCODING=>'']); $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch); if($body===false||$code>=400) return null; return $body; }
function norm_trip($t){ $t=trim((string)$t); if($t==='') return ''; return str_starts_with($t,'◆')?$t:'◆'.$t; }
function clean_text($v){ return trim(html_entity_decode(strip_tags((string)$v),ENT_QUOTES|ENT_HTML5,'UTF-8')); }
function arr_get($a,$keys,$default=null){ foreach($keys as $k){ if(is_array($a)&&array_key_exists($k,$a)) return $a[$k]; } return $default; }
function find_player_records($data){
 $out=[];
 $walk=function($x)use(&$walk,&$out){
   if(!is_array($x)) return;
   $name=arr_get($x,['name','player_name','username','user_name','player']);
   if($name!==null && trim((string)$name)!=='') {
     $trip=arr_get($x,['trip','tripcode','trip_code','torip']); $role=arr_get($x,['role','job','job_name','position']); $side=arr_get($x,['side','team','camp','faction']); $result=arr_get($x,['result','winlose','outcome','result_text']);
     $out[]=['name'=>clean_text($name),'trip'=>norm_trip($trip),'role'=>clean_text($role),'side'=>clean_text($side),'result'=>clean_text($result),'speech'=>(int)arr_get($x,['speech','speech_count','talk_count','post_count'],0),'questions'=>(int)arr_get($x,['questions','question_count'],0),'mentions'=>(int)arr_get($x,['mentions','mention_count'],0)];
   }
   foreach($x as $v) if(is_array($v)) $walk($v);
 };
 $walk($data);
 $uniq=[]; foreach($out as $p){$k=$p['name'].'\0'.$p['trip'].'\0'.$p['role'];$uniq[$k]=$p;} return array_values($uniq);
}
function parse_game($room,$raw,$source){
 $data=json_decode($raw,true); if($data===null) return null;
 $players=find_player_records($data); if(!$players) return null;
 $winner=''; $date=''; $id='';
 $flat=json_encode($data,JSON_UNESCAPED_UNICODE);
 if(is_array($data)){ $id=(string)(arr_get($data,['game_id','id','room_id'],'')); $date=(string)(arr_get($data,['date','game_date','started_at','start_time','created_at'],'')); $winner=(string)(arr_get($data,['winner','winner_side','win_side'],'')); }
 if($id==='') $id='room:'.sha1($room);
 return ['id'=>$id,'room_name'=>$room,'game_date'=>$date,'winner_side'=>$winner,'players'=>$players,'raw_json'=>$raw,'source_url'=>$source];
}
function list_finished_rooms(){
 $c=cfg(); $u=$c['base_url'].'room_list.php?scene='.rawurlencode('終了'); $html=http_get($u); if($html===null) $html=http_get($c['base_url'].'room_list.php?mode=finish'); if($html===null) return [];
 $text=clean_text($html); $rooms=[];
 // 現行モバイル一覧は「終了 + 村名」→ 人数 → 経過時間 → RM の順。HTML構造変更に備え複数パターンを併用。
 if(preg_match_all('/終了\s*([^\r\n<>]{1,120})/u',$text,$m)) foreach($m[1] as $r){$r=trim(preg_replace('/\s+/u',' ',$r)); if($r!==''&&!in_array($r,$rooms,true))$rooms[]=$r;}
 foreach($rooms as &$r){$r=preg_replace('/\s+(人狼系|初心者歓迎|中級以上|ワンナイト|雑談系|身内|特殊村|カオス).*/u','',$r);$r=trim($r);} unset($r);
 return array_values(array_filter(array_unique($rooms),fn($x)=>$x!==''));
}
function collect($limit=null){
 $c=cfg(); $limit=$limit?:$c['max_rooms_per_run']; $rooms=array_slice(list_finished_rooms(),0,$limit); $pdo=db(); $count=0;$skipped=0;$errors=[];
 foreach($rooms as $room){
   $url=$c['base_url'].'json/?mode=get&room='.rawurlencode($room); $raw=http_get($url); if($raw===null){$errors[]=$room;continue;} $g=parse_game($room,$raw,$url); if(!$g){$skipped++;continue;}
   $st=$pdo->prepare('INSERT OR REPLACE INTO games(id,room_name,fetched_at,game_date,winner_side,raw_json,source_url) VALUES(?,?,?,?,?,?,?)'); $st->execute([$g['id'],$g['room_name'],gmdate('c'),$g['game_date'],$g['winner_side'],$g['raw_json'],$g['source_url']]);
   $pdo->prepare('DELETE FROM participations WHERE game_id=?')->execute([$g['id']]);
   foreach($g['players'] as $p){$q=$pdo->prepare('INSERT INTO players(name,trip) VALUES(?,?) ON CONFLICT(name,trip) DO UPDATE SET name=excluded.name');$q->execute([$p['name'],$p['trip']]);$pid=(int)$pdo->lastInsertId(); if(!$pid){$pid=(int)$pdo->query('SELECT id FROM players WHERE name='. $pdo->quote($p['name']).' AND trip='. $pdo->quote($p['trip']))->fetchColumn();}
     $r=$pdo->prepare('INSERT OR REPLACE INTO participations(game_id,player_id,role,side,result,speech,questions,mentions) VALUES(?,?,?,?,?,?,?,?)');$r->execute([$g['id'],$pid,$p['role'],$p['side'],$p['result'],$p['speech'],$p['questions'],$p['mentions']]);
   }
   $count++; usleep($c['request_delay_us']);
 }
 return ['rooms_seen'=>count($rooms),'games_updated'=>$count,'skipped'=>$skipped,'errors'=>$errors,'time'=>gmdate('c')];
}
function stats_players($q=''){
 $sql="SELECT p.id,p.name,p.trip,COUNT(pa.game_id) games,SUM(CASE WHEN pa.result IN ('win','勝利','勝') OR lower(pa.result) LIKE '%win%' THEN 1 ELSE 0 END) wins,SUM(COALESCE(pa.speech,0)) speech FROM players p LEFT JOIN participations pa ON pa.player_id=p.id"; $args=[]; if($q!==''){ $sql.=' WHERE p.name LIKE ? OR p.trip LIKE ?'; $args=["%$q%","%$q%"]; } $sql.=' GROUP BY p.id ORDER BY games DESC'; $s=db()->prepare($sql);$s->execute($args);return $s->fetchAll();
}

function snapshot(){
 $pdo=db(); $players=$pdo->query("SELECT id,name,trip FROM players ORDER BY id")->fetchAll(); $byId=[]; foreach($players as &$p){$byId[$p['id']]=$p;} unset($p);
 $games=[]; $gs=$pdo->query("SELECT id,room_name,game_date,winner_side,raw_json FROM games ORDER BY game_date DESC,fetched_at DESC LIMIT 1000");
 foreach($gs as $g){$parts=[];$q=$pdo->prepare("SELECT pa.*,p.name,p.trip FROM participations pa JOIN players p ON p.id=pa.player_id WHERE pa.game_id=?");$q->execute([$g['id']]);foreach($q as $r){$parts[]=['id'=>'srv:'.$r['player_id'],'name'=>$r['name'],'trip'=>$r['trip'],'role'=>$r['role'],'side'=>$r['side'],'result'=>$r['result'],'speech'=>(int)$r['speech'],'questions'=>(int)$r['questions'],'mentions'=>(int)$r['mentions']];}$games[]=['id'=>'srvgame:'.$g['id'],'name'=>$g['room_name'],'date'=>$g['game_date'],'winner'=>$g['winner_side'],'players'=>array_column($parts,'id'),'participants'=>$parts,'log'=>'自動取得した公開ゲームデータ'];}
 return ['players'=>array_map(fn($p)=>['id'=>'srv:'.$p['id'],'name'=>$p['name'],'trip'=>$p['trip']],$players),'games'=>$games];
}
