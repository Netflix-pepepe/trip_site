"use strict";

let crypt = null;


/* =========================================
   初期化
========================================= */

try {

    importScripts("./unix-crypt-td.min.js");

    if (typeof self.unixCryptTD === "function") {

        crypt = self.unixCryptTD;

    } else if (typeof self.z === "function") {

        crypt = self.z;

    } else {

        throw new Error(
            "unixCryptTD が見つかりません"
        );
    }

    self.postMessage({
        type: "ready"
    });

} catch (e) {

    self.postMessage({
        type: "error",
        message:
            e && e.stack
                ? e.stack
                : String(e)
    });
}


/* =========================================
   メッセージ
========================================= */

self.onmessage = function (event) {

    const data =
        event.data || {};

    if (data.type === "test") {

        try {

            const key =
                "aaaaaaaa";

            const trip =
                make10Trip(key);

            self.postMessage({
                type: "test-ok",
                key: key,
                trip: trip
            });

        } catch (e) {

            self.postMessage({
                type: "error",
                message:
                    e && e.stack
                        ? e.stack
                        : String(e)
            });
        }

        return;
    }


    if (data.type === "convert") {

        try {

            const key =
                String(
                    data.key || ""
                );

            if (!key) {

                throw new Error(
                    "キーが空です"
                );
            }


            const result =
                convertTrip(key);


            self.postMessage({

                type: "result",

                key: key,

                trip:
                    result.trip,

                length:
                    result.length,

                mode:
                    result.mode
            });

        } catch (e) {

            self.postMessage({

                type: "error",

                message:
                    e && e.stack
                        ? e.stack
                        : String(e)
            });
        }

        return;
    }
};


/* =========================================
   メイン変換
========================================= */

function convertTrip(key) {

    /*
     * ここでは通常の10桁方式を使用。
     *
     * 2ch系ではキーのバイト長などによって
     * 10桁 / 12桁などの方式が分かれる。
     */

    const bytes =
        utf8Bytes(key);


    /*
     * 10桁方式
     */
    if (bytes.length <= 11) {

        const trip =
            make10Trip(key);

        return {

            trip: trip,

            length: 10,

            mode: "unix-crypt"
        };
    }


    /*
     * 現在の z は10桁Unix crypt実装なので、
     * 12桁方式をここで偽装しない。
     *
     * 12桁を完全互換にする場合は、
     * 12桁用のアルゴリズムを別途実装する。
     */

    throw new Error(
        "12桁キーには12桁方式の実装が必要です"
    );
}


/* =========================================
   10桁 Trip
========================================= */

function make10Trip(key) {

    if (
        typeof crypt !== "function"
    ) {

        throw new Error(
            "unixCryptTD unavailable"
        );
    }


    key =
        String(key);


    /*
     * Unix cryptではsaltに
     * 先頭2文字を利用する。
     */

    let salt =
        key.substring(0, 2);


    if (
        salt.length < 2
    ) {

        salt =
            (
                salt + "AA"
            ).substring(0, 2);
    }


    /*
     * crypt実行
     */

    const result =
        crypt(
            key,
            salt
        );


    if (
        typeof result !== "string"
    ) {

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }


    /*
     * saltの2文字を除外。
     *
     * ここでは従来コードと同じ
     * 10文字を使用する。
     */

    return result.substring(
        2,
        12
    );
}


/* =========================================
   UTF-8バイト列
========================================= */

function utf8Bytes(text) {

    /*
     * Worker環境で
     * TextEncoderが利用可能なら使用。
     */

    if (
        typeof TextEncoder !==
        "undefined"
    ) {

        return Array.from(
            new TextEncoder().encode(
                String(text)
            )
        );
    }


    /*
     * フォールバック
     */

    const encoded =
        unescape(
            encodeURIComponent(
                String(text)
            )
        );

    const result = [];

    for (
        let i = 0;
        i < encoded.length;
        i++
    ) {

        result.push(
            encoded.charCodeAt(i)
        );
    }

    return result;
}
