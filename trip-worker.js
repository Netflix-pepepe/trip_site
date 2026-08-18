"use strict";

/*
 * trip-worker.js
 *
 * unix-crypt-td.min.js
 *   └─ self.unixCryptTD / self.z
 *
 * 既知のトリップキーを
 * 10桁Unix crypt系Tripへ変換するWorker
 */

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
            "unixCryptTD / z が見つかりません"
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

    if (data.type === "convert") {

        try {

            const key =
                String(
                    data.key || ""
                );

            if (!key) {

                throw new Error(
                    "トリップキーが空です"
                );
            }

            const result =
                makeTrip10(key);

            self.postMessage({

                type: "result",

                key: key,

                trip: result.trip,

                salt: result.salt,

                bytes: result.bytes

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


    if (data.type === "test") {

        try {

            const result =
                makeTrip10("test");

            self.postMessage({

                type: "test-ok",

                key: "test",

                trip: result.trip,

                salt: result.salt,

                bytes: result.bytes

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
   10桁Trip生成
========================================= */

function makeTrip10(key) {

    if (typeof crypt !== "function") {

        throw new Error(
            "unixCryptTD unavailable"
        );
    }


    /*
     * 2ch系10桁Tripは
     * キーのバイト列を基準に処理する。
     *
     * ここではASCIIキーを対象にする。
     *
     * 日本語などShift_JISが必要なキーは
     * 別途Shift_JISエンコーダーが必要。
     */

    const bytes =
        asciiBytes(key);


    /*
     * 11バイトを超えるキーは
     * この10桁方式の対象外。
     */

    if (bytes.length > 11) {

        throw new Error(
            "10桁Tripは11バイト以下のキーを使用してください"
        );
    }


    /*
     * 先頭8バイトを使用
     */

    const used =
        bytes.slice(0, 8);


    /*
     * ASCII文字列へ戻す
     */

    let password = "";

    for (
        let i = 0;
        i < used.length;
        i++
    ) {

        password +=
            String.fromCharCode(
                used[i]
            );
    }


    /*
     * Unix cryptのsalt生成
     *
     * 先頭2文字ではなく、
     * Tripcode方式のsaltを生成する。
     */

    let salt =
        (
            password +
            "H."
        ).substring(1, 3);


    /*
     * saltに使用できない文字を
     * "."へ置換
     */

    salt =
        salt.replace(
            /[^.-z]/g,
            "."
        );


    /*
     * ":" → ";"
     * ";" → "<"
     *
     * cryptのsalt範囲に合わせる
     */

    salt =
        salt.replace(
            /:/g,
            ";"
        );

    salt =
        salt.replace(
            /;/g,
            "<"
        );


    /*
     * crypt実行
     */

    const result =
        crypt(
            password,
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
     * Unix crypt結果:
     *
     * [salt 2文字]
     * [trip部分]
     *
     * Tripは10文字取得
     */

    const trip =
        result.substring(3, 13);


    return {

        trip: trip,

        salt: salt,

        bytes: used

    };
}


/* =========================================
   ASCII byte
========================================= */

function asciiBytes(text) {

    const result = [];

    text =
        String(text);

    for (
        let i = 0;
        i < text.length;
        i++
    ) {

        const code =
            text.charCodeAt(i);

        if (code > 0x7f) {

            throw new Error(
                "この版ではASCIIキーのみ対応しています。日本語キーにはShift_JIS変換が必要です。"
            );
        }

        result.push(code);
    }

    return result;
}
