人狼オンライン GitHub Pages版

1. このフォルダの index.html / worker.js / unix-crypt-td.min.js をGitHub Pagesの公開フォルダに置いてください。
2. PHPやAPI URL、APIキーの設定は不要です。
3. 個人戦績は公開ログ検索APIから実データを取得します。直接接続がCORSで拒否された場合は内蔵のCORSプロキシを自動で試します。
4. 検索で取得したログだけをブラウザ内に保存し、ランキングはその実データだけから集計します。架空のサンプル名は入れていません。
5. GitHub PagesではPHPは動かないため、backend/api.phpは使いません。

注意:
公開ログAPIやCORSプロキシが停止・制限中の場合は検索できません。その場合はサイト側ではなく外部サービス側の通信条件によるものです。

トリップ検索の10桁生成には unix-crypt-td-js を使用しています。公式npm配布物が取得できない環境ではworkerがjsDelivr版へフォールバックします。
