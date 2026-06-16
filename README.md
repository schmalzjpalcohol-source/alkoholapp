# ProofFlow

GitHub Pages 用の静的なモバイル向け React アプリです。利用者は出発・到着の種別、氏名、BAC値を入力し、本人写真とアルコール検知器の写真を撮影します。アプリは入力内容と2枚の写真を含むPDFを作成し、iPhone の共有画面からメールで送信します。

GitHub Pages ではバックエンド、データベース、自動メール送信は実行できません。そのため、このアプリはブラウザ上でPDFレポートを準備し、iPhone の共有画面からメールアプリを選んで送信する形にしています。

## 宛先の設定

宛先は `src/App.jsx` で設定します。

```js
const RECIPIENT_EMAIL = "recipient@example.invalid";
```

## ローカル起動

```bash
npm install
npm run client:dev
```

ターミナルに表示された Vite のURLを開きます。

## GitHub Pages 用ビルド

```bash
npm run build:pages
```

生成された `docs` フォルダをコミットして GitHub Pages で公開します。

推奨設定:

```text
Source: Deploy from a branch
Branch: test/githubpages_test
Folder: /docs
```

## 注意点

- GitHub Pages は静的サイトなので、ログイン機能やデータベースはありません。
- メールの完全自動送信はできません。
- 「メールを送信」を押すと、入力内容と2枚の写真を含むPDFを添付した状態で iPhone の共有画面が開きます。
- 共有画面で Mail を選び、利用者が送信を確定します。
