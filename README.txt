人狼オンライン データベース - サーバーDB方式

この版は、参考サイト「人狼オンライン戦績解析＆Wiki」の個人戦績の仕組みを参考に、
ブラウザ内のサンプルDBではなく、PHP + SQLite のサーバーDBを中心に動かします。

個人戦績:
  名前/トリップ -> backend/api.php?action=search -> 公開ログ検索API -> 集計表示

ランキング:
  backend/api.php?action=ranking -> サーバーDBの参加記録を期間・指標別に集計

同期:
  backend/api.php?action=sync -> サーバー側DBへ公開ログを取り込み
  cron.php を定期実行することで継続更新できます。

参考にした仕様:
  個人戦績は名前またはトリップから検索し、配役別・役職別の勝率、参戦ログ等を表示。
  ログ検索APIは name / trip / room_name / jobset / s_date / e_date / totsushi / one_night / word_wolf を受け、
  log_data 内に id, room_name, jobset, winner, players(name, trip, job, die, mes, ...), date 等を返す方式です。

設置:
  1. backend/ をPHP + cURL + SQLiteが使えるサーバーへ配置。
  2. index/ をWeb公開ディレクトリへ配置。
  3. 同一サイト配下ならデフォルトの backend/api.php がそのまま使えます。
  4. cron.php を10分～1時間ごと等で実行してください。
  5. 「個人戦績」は実データが無ければ「データなし」と表示し、架空プレイヤーは生成しません。
