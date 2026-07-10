# Steam人数おすすめチェッカー

プレイしたい人数と遊び方から、Steamで遊びたいゲーム候補を探す静的サイトです。

## できること

- プレイ人数でおすすめ候補を採点
- 協力プレイ / 対戦プレイで絞り込み
- 対応人数 / レビュー言及 / ちょうど人数 / その人数以上 / 近い人数を切り替え
- タイトル検索
- 無料だけ / セール中だけ / 予算内で絞り込み
- 日本語対応ゲームで絞り込み
- 価格、割引率、Steamレビュー評価の表示
- レビュー抜粋からおすすめ根拠を確認
- 条件をURLとして共有
- 気になるゲームをブラウザ内にキープ
- レビュー件数で絞り込み
- おすすめ度順 / 割引率順 / 安い順 / 人数が近い順 / タイトル順の並び替え
- GitHub ActionsでSteamデータを定期更新

## ローカルで確認する

HTMLを直接ダブルクリックすると、ブラウザの制限で `games.json` を読み込めない場合があります。
このフォルダで以下のようにローカルサーバーを起動してください。

```bash
python3 -m http.server 8000
```

その後、ブラウザで `http://localhost:8000` を開きます。

## Steamデータを更新する

`tools/fetch_steam_data.py` を実行すると、Steam Store情報と公開レビューから `games.json` を作り直します。

```bash
python3 tools/fetch_steam_data.py
```

対象ゲームを増やす場合は、環境変数 `STEAM_APPIDS` にSteam App IDをカンマ区切りで指定できます。

```bash
STEAM_APPIDS=413150,728880,945360 python3 tools/fetch_steam_data.py
```

レビュー件数で足切りしたい場合は `STEAM_MIN_REVIEWS` を指定できます。

```bash
STEAM_MIN_REVIEWS=1000 python3 tools/fetch_steam_data.py
```

何も指定しない場合は、`tools/fetch_steam_data.py` 内の `DEFAULT_APP_IDS` にある候補を使います。

## GitHub Pagesで公開する

1. GitHubで新しいリポジトリを作成
2. このフォルダ内のファイルをリポジトリ直下に置く
3. `Settings` → `Pages` を開く
4. `Build and deployment` の `Source` を `GitHub Actions` にする
5. `Actions` タブで `Deploy GitHub Pages` が完了するのを待つ

数分後に公開URLが表示されます。

## GitHub Actionsで自動更新する

`.github/workflows/update-steam-data.yml` が入っています。

- `Actions` タブから手動実行できます
- 毎日1回、`games.json` を更新します
- 更新があった場合は自動でコミットします

価格やセール情報はSteam側の現在情報をもとに更新されます。
