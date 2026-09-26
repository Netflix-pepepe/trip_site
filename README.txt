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
終了村一覧 → 各村の /m/json/?mode=get&room=村名 を取得 → SQLiteへ保存 → 個人戦績・ランキングの集計元にします。
既取得村も再取得して結果を更新します。API仕様変更時は backend/common.php の parse_game() を調整してください。

【注意】
zinro.net の公開情報のみを対象にし、アクセス間隔を設けています。サイト側の利用規約・robots・負荷制限に従ってください。
収集結果は公開情報でも、利用目的・保存期間・公開範囲について自サイトのプライバシーポリシーを用意してください。
