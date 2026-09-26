<?php
function cfg(){ static $c; return $c ??= require __DIR__.'/config.php'; }
function db(){ static $pdo; if($pdo) return $pdo; $c=cfg(); $pdo=new PDO('sqlite:'.$c['db'],null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]); $pdo->exec(file_get_contents(__DIR__.'/schema.sql')); return $pdo; }
function http_get($url){ $c=cfg(); $ch=curl_init($url); curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_FOLLOWLOCATION=>true,CURLOPT_CONNECTTIMEOUT=>$c['request_timeout'],CURLOPT_TIMEOUT=>$c['request_timeout'],CURLOPT_USERAGENT=>$c['user_agent'],CURLOPT_ENCODING=>'',CURLOPT_SSL_VERIFYPEER=>true]); $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch); if($body===false||$code>=400) return null; return $body; }
function norm_trip($t){ $t=trim((string)$t); if($t==='') return ''; return str_starts_with($t,'◆')||str_starts_with($t,'◇')?$t:'◆'.$t; }
function clean_text($v){ return trim(html_entity_decode(strip_tags((string)$v),ENT_QUOTES|ENT_HTML5,'UTF-8')); }
function html_text($html){ $html=preg_replace('/<script\b[^>]*>.*?<\/script>|<style\b[^>]*>.*?<\/style>/is',' ',$html); $html=preg_replace('/<br\s*\/?>/i',"\n",$html); $html=preg_replace('/<\/tr\s*>/i',"\n",$html); $html=preg_replace('/<\/(td|th)\s*>/i',"\t",$html); $html=html_entity_decode(strip_tags($html),ENT_QUOTES|ENT_HTML5,'UTF-8'); $html=str_replace("\xC2\xA0",' ',$html); $html=preg_replace('/[ \t]+/u',' ',$html); $html=preg_replace('/\n{2,}/u',"\n",$html); return trim($html); }
function arr_get($a,$keys,$default=null){ foreach($keys as $k){ if(is_array($a)&&array_key_exists($k,$a)) return $a[$k]; } return $default; }
function same_host($url,$base){ $a=parse_url($url);$b=parse_url($base);return ($a['host']??'')===($b['host']??''); }
function absolute_url($href,$base){ $href=html_entity_decode(trim($href),ENT_QUOTES|ENT_HTML5,'UTF-8'); if($href==='') return ''; if(str_starts_with($href,'http://')||str_starts_with($href,'https://')) return $href; $p=parse_url($base); $origin=($p['scheme']??'https').'://'.($p['host']??''); if(str_starts_with($href,'/')) return $origin.$href; return rtrim(dirname($p['path']??'/'),'/').'/'.$href; }
function extract_log_ids($html,$base){ $urls=[]; if(preg_match_all("~href\s*=\s*[\"']([^\"']+)[\"']~i",$html,$m)){ foreach($m[1] as $href){$u=absolute_url($href,$base); if(!same_host($u,$base))continue; if(preg_match('~log\.php\?[^\"\'<>]*[&?]id=(\d+)~i',$u,$x)) $urls[(string)$x[1]] = $u; }} return array_values($urls); }
function find_room_links($html,$base){ $out=[]; if(!preg_match_all("~href\s*=\s*[\"']([^\"']+)[\"']~i",$html,$m)) return []; foreach($m[1] as $href){$u=absolute_url($href,$base); if(!same_host($u,$base))continue; $path=parse_url($u,PHP_URL_PATH)??'';$q=parse_url($u,PHP_URL_QUERY)??''; if(!$q)continue; if(str_contains($q,'scene=')||str_contains($q,'mode=')||str_contains($q,'tab='))continue; if(str_contains($path,'log.php'))continue; $out[$u]=$u;} return array_values($out); }
function parse_log($id,$html,$source,$roomName=''){
 $text=html_text($html); if($text==='')return null;
 $title=''; if(preg_match('/ログ-([^\n]+)/u',$text,$m))$title=trim($m[1]); if($roomName==='')$roomName=$title?:('ゲーム#'.$id);
 $players=[];
 // The final player/status table is the reliable source of name + role + alive/dead state.
 if(preg_match_all('/^([^\t\n|]{1,80})\t+(生|死|観戦者)\s*(?:\(([^)\n]+)\))?\s*$/mu',$text,$m,PREG_SET_ORDER)){
   foreach($m as $r){$name=trim($r[1]);$state=$r[2];$role=trim($r[3]??'');if($name===''||$role==='観戦者'||$state==='観戦者')continue;$players[$name]=['name'=>$name,'trip'=>'','role'=>$role,'side'=>side_from_role($role),'result'=>'','speech'=>0,'questions'=>0,'mentions'=>0];}
 }
 // Fallback for HTML where table cells are separated by pipes after conversion.
 if(!$players && preg_match_all('/([^\n|]+)\s*\|\s*(生|死)\s*\(([^)]+)\)/u',$text,$m,PREG_SET_ORDER)){
   foreach($m as $r){$name=trim($r[1]);$role=trim($r[3]);if($name!==''&&$role!=='観戦者')$players[$name]=['name'=>$name,'trip'=>'','role'=>$role,'side'=>side_from_role($role),'result'=>'','speech'=>0,'questions'=>0,'mentions'=>0];}
 }
 if(!$players)return null;
 $winner=''; if(preg_match('/〖([^〗]+)チーム〗の勝利/u',$text,$m))$winner=winner_side($m[1]);
 if($winner===''&&preg_match('/〖(村人|人狼|妖狐|恋人|てるてる)[^〗]*〗の勝利/u',$text,$m))$winner=winner_side($m[1]);
 // Count normal public chat lines by speaker. System/whisper/GM/霊界 are excluded from speech count.
 foreach($players as $name=>&$p){
   $pat='/^'.preg_quote($name,'/').'(?:→[^:\n]+)?\s*:\s*(.+)$/mu';
   if(preg_match_all($pat,$text,$mm)) foreach($mm[1] as $msg){ if(preg_match('/^(?:鯖|実行@|投票@|.*さんは|.*さんが)/u',$msg))continue; $p['speech']++; if(preg_match('/[?？]/u',$msg))$p['questions']++; }
 }
 unset($p);
 foreach($players as &$p){ $p['result']=result_for($p['side'],$winner); }
 unset($p);
 $gameDate=''; if(preg_match('/(20\d{2}[-\/]\d{1,2}[-\/]\d{1,2})/',$text,$m))$gameDate=$m[1];
 return ['id'=>(string)$id,'room_name'=>$roomName,'game_date'=>$gameDate,'winner_side'=>$winner,'players'=>array_values($players),'raw_json'=>json_encode(['source'=>'log.php','id'=>$id,'text'=>$text],JSON_UNESCAPED_UNICODE),'source_url'=>$source];
}
function side_from_role($role){$r=str_replace([' ','　'],'',$role);if(in_array($r,['人狼','狂人','狂信者','黒猫'],true))return '狼';if(in_array($r,['妖狐','背徳者','恋人'],true))return '第三';return '村';}
function winner_side($w){$w=str_replace(['チーム','陣営'],'',$w);if(str_contains($w,'人狼'))return '狼';if(str_contains($w,'妖狐'))return '第三';return '村';}
function result_for($side,$winner){if($winner===''||$side==='')return '';return $side===$winner?'win':'lose';}
function list_finished_logs(){
 $c=cfg();$base=$c['base_url'];$list=$base.'room_list.php?scene='.rawurlencode('終了');$html=http_get($list);if($html===null)$html=http_get($base.'room_list.php?mode=finish');if($html===null)return [];
 $logs=extract_log_ids($html,$base);
 // Current room list may link to a room page first. Follow same-host room links and discover log.php?id=... there.
 if(!$logs){$links=array_slice(find_room_links($html,$base),0,max(1,(int)$c['max_rooms_per_run']));foreach($links as $u){$room=http_get($u);if($room===null)continue;foreach(extract_log_ids($room,$base) as $lu)$logs[]=$lu;if(count($logs)>=$c['max_rooms_per_run'])break;usleep($c['request_delay_us']);}}
 $out=[];foreach(array_values(array_unique($logs)) as $u){if(preg_match('/[?&]id=(\d+)/',$u,$m))$out[]=['id'=>$m[1],'url'=>$u];if(count($out)>=$c['max_rooms_per_run'])break;}return $out;
}
function collect($limit=null){
 $c=cfg();$limit=$limit?:$c['max_rooms_per_run'];$logs=array_slice(list_finished_logs(),0,$limit);$pdo=db();$count=0;$skipped=0;$errors=[];
 foreach($logs as $item){$raw=http_get($item['url']);if($raw===null){$errors[]=$item['id'];continue;}$g=parse_log($item['id'],$raw,$item['url']);if(!$g){$skipped++;continue;}
   $st=$pdo->prepare('INSERT OR REPLACE INTO games(id,room_name,fetched_at,game_date,winner_side,raw_json,source_url) VALUES(?,?,?,?,?,?,?)');$st->execute([$g['id'],$g['room_name'],gmdate('c'),$g['game_date'],$g['winner_side'],$g['raw_json'],$g['source_url']]);
   $pdo->prepare('DELETE FROM participations WHERE game_id=?')->execute([$g['id']]);
   foreach($g['players'] as $p){$q=$pdo->prepare('INSERT INTO players(name,trip) VALUES(?,?) ON CONFLICT(name,trip) DO UPDATE SET name=excluded.name');$q->execute([$p['name'],$p['trip']]);$pid=(int)$pdo->lastInsertId();if(!$pid){$s=$pdo->prepare('SELECT id FROM players WHERE name=? AND trip=?');$s->execute([$p['name'],$p['trip']]);$pid=(int)$s->fetchColumn();}$r=$pdo->prepare('INSERT OR REPLACE INTO participations(game_id,player_id,role,side,result,speech,questions,mentions) VALUES(?,?,?,?,?,?,?,?)');$r->execute([$g['id'],$pid,$p['role'],$p['side'],$p['result'],$p['speech'],$p['questions'],$p['mentions']]);}
   $count++;usleep($c['request_delay_us']);
 }
 return ['rooms_seen'=>count($logs),'games_updated'=>$count,'skipped'=>$skipped,'errors'=>$errors,'time'=>gmdate('c')];
}
function stats_players($q=''){
 $sql="SELECT p.id,p.name,p.trip,COUNT(pa.game_id) games,SUM(CASE WHEN pa.result='win' THEN 1 ELSE 0 END) wins,SUM(COALESCE(pa.speech,0)) speech FROM players p LEFT JOIN participations pa ON pa.player_id=p.id";$args=[];if($q!==''){$sql.=' WHERE p.name LIKE ? OR p.trip LIKE ?';$args=["%$q%","%$q%"];}$sql.=' GROUP BY p.id ORDER BY games DESC';$s=db()->prepare($sql);$s->execute($args);return $s->fetchAll();
}
function snapshot(){
 $pdo=db();$players=$pdo->query("SELECT id,name,trip FROM players ORDER BY id")->fetchAll();$games=[];$gs=$pdo->query("SELECT id,room_name,game_date,winner_side,raw_json,source_url FROM games ORDER BY fetched_at DESC LIMIT 1000");
 foreach($gs as $g){$parts=[];$q=$pdo->prepare("SELECT pa.*,p.name,p.trip FROM participations pa JOIN players p ON p.id=pa.player_id WHERE pa.game_id=?");$q->execute([$g['id']]);foreach($q as $r)$parts[]=['id'=>'srv:'.$r['player_id'],'name'=>$r['name'],'trip'=>$r['trip'],'role'=>$r['role'],'side'=>$r['side'],'result'=>$r['result'],'speech'=>(int)$r['speech'],'questions'=>(int)$r['questions'],'mentions'=>(int)$r['mentions']];$games[]=['id'=>'srvgame:'.$g['id'],'name'=>$g['room_name'],'date'=>$g['game_date'],'winner'=>$g['winner_side'],'players'=>array_column($parts,'id'),'participants'=>$parts,'log'=>'公開ログから自動解析','source'=>$g['source_url']];}
 return ['players'=>array_map(fn($p)=>['id'=>'srv:'.$p['id'],'name'=>$p['name'],'trip'=>$p['trip']],$players),'games'=>$games];
}
