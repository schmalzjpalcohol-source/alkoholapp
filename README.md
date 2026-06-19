# ProofFlow

GitHub Pages 用の静的なモバイル向け React アプリです。利用者は業務前・業務後の種別とショートネームを入力し、本人写真とアルコール検知器の写真を撮影したあと、BrAC値と備考を入力します。アプリは記録内容をまとめたPDFを作成し、iPhone の共有画面からメールで送信します。

このリポジトリは静的サイトとして運用します。バックエンド、データベース、ログイン機能、サーバー側の保存処理は使用していません。

## Outlook での送信

宛先はアプリ内には保存しません。共有画面で Outlook を選んだあと、利用者が Outlook 上で宛先を入力します。

Outlook の件名は固定です。

```text
アルコールチェック報告
```

## ローカル起動

```bash
npm install
npm run dev
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
- 入力内容と写真はアプリのサーバーには保存されません。
- 「Outlookで送信」を押すと、記録内容をまとめたPDF報告書のみを添付した状態で iPhone の共有画面が開きます。
- 共有画面で Outlook を選び、利用者が宛先を入力して送信を確定します。
