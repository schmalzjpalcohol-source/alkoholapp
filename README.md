# ProofFlow

GitHub Pages 用の静的なモバイル向け React アプリです。利用者は業務前・業務後の種別と短縮名を入力し、本人写真とアルコール検知器の写真を撮影したあと、BAC値と備考を入力します。アプリは入力内容と2枚の写真を含むPDFを作成し、iPhone の共有画面からメールで送信します。

GitHub Pages ではバックエンド、データベース、自動メール送信は実行できません。そのため、このアプリはブラウザ上でPDFレポートを準備し、iPhone の共有画面からメールアプリを選んで送信する形にしています。

## Outlook での送信

宛先はアプリ内には保存しません。共有画面で Outlook を選んだあと、利用者が Outlook 上で宛先を入力します。

Outlook の自動仕分けに使いやすいように、件名は固定形式です。

```text
【アルコールチェック】【業務前/業務後】【YYYY-MM-DD HH:mm】【短縮名】【BAC:0.00】
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
- 「Outlookで送信」を押すと、PDF報告書、本人写真、アルコール検知器の写真を添付した状態で iPhone の共有画面が開きます。
- 共有画面で Outlook を選び、利用者が宛先を入力して送信を確定します。
