人狼Online 総合戦績サイト - 実データAPI版

重要：この版はサンプル戦績を生成しません。個人戦績は公開ログ検索APIから取得します。

1. backend/config.php の log_api_base は公開ログ検索APIのエンドポイントです。
2. backend/ を PHP + SQLite + cURL が使えるサーバーへ配置します。
3. index/index.html をGitHub Pages等へ配置する場合、データ管理→自動戦績取得で、配置した backend/api.php のURLを設定します。
4. 個人戦績タブで「名前」または「トリップ」を入力し、実データを検索します。
5. backend/cron.php は終了村収集用の補助機能です。個人検索は公開ログ検索APIを直接利用します。

API仕様の根拠：olivier-zinro.fc2.net の「ログ検索APIの公開」。name/trip等で検索でき、log_data にゲームID、村名、役職設定、勝利陣営、各プレイヤーの名前・トリップ・役職・死亡フラグ・発言回数・日時等が返る仕様です。

注意：公開API・対象サイトの仕様変更や利用制限により取得できなくなる可能性があります。
