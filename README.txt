🐺 人狼オンライン データベース - 自動戦績取得版

【構成】
index/index.html : 既存の総合サイトUI
index/worker.js : トリップ検索Worker
index/unix-crypt-td.min.js : Unix crypt実装
backend/ : PHP + SQLite の自動収集サーバー

【設置】
1. PHP 8.1+、PDO_SQLite、cURL を有効にしたサーバーへ index と backend をアップロード。
2. backend/config.php の base_url / user_agent / max_rooms_per_run を確認。
3. backend/api.php?action=status にアクセスしてDB初期化を確認。
4. cronで10分ごとに backend/cron.php を実行。
   例: */10 * * * * php /home/USER/www/backend/cron.php >> /home/USER/www/backend/cron.log 2>&1
5. index/index.html のAPI設定欄に、実際の backend/api.php のURLを設定。

【自動取得】
終了村一覧 → 村ページの公開ログURLを発見 → /m/log.php?id=XXXX を取得 → 最終参加者表・役職・勝敗メッセージ・発言を解析 → SQLiteへ保存 → 個人戦績・ランキング・同村関係の集計元にします。
トリップはログ公開ページに含まれない場合があるため、取得できない場合は空欄のまま保存します。既取得村も再取得して結果を更新します。API仕様変更時は backend/common.php の parse_log() / list_finished_logs() を調整してください。

【今回の修正版】
前版の「/m/json/?mode=get&room=村名」決め打ち方式を廃止し、実際の公開ゲームログ（log.php?id=...）を直接解析する方式に変更しています。人狼Onlineの公開ログには参加者の状態・役職、勝利陣営を示すサーバーメッセージ、発言ログが含まれるため、名前ベースの戦績を生成できます。

【注意】
zinro.net の公開情報のみを対象にし、アクセス間隔を設けています。サイト側の利用規約・robots・負荷制限に従ってください。
収集結果は公開情報でも、利用目的・保存期間・公開範囲について自サイトのプライバシーポリシーを用意してください。
