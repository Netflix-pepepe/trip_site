"use strict";

let crypt = null;
let running = false;
let searchToken = 0;

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

    const data = event.data || {};

    /* -----------------------------
       停止
    ----------------------------- */

    if (data.type === "stop") {

        running = false;

        /*
         * 現在の検索を無効化
         */
        searchToken++;

        self.postMessage({
            type: "stopping"
        });

        return;
    }


    /* -----------------------------
       test
    ----------------------------- */

    if (data.type === "test") {

        if (typeof crypt !== "function") {

            self.postMessage({
                type: "error",
                message:
                    "crypt is not a function"
            });

            return;
        }

        try {

            const tests = [
                "foob",
                "Jim",
                "aaaaaaaaaa",
                "test"
            ];

            const results = [];

            for (const key of tests) {

                results.push({
                    key: key,
                    trip: makeTrip(key)
                });
            }

            self.postMessage({
                type: "test-results",
                results: results
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


    /* -----------------------------
       search
    ----------------------------- */

    if (data.type === "search") {

        if (typeof crypt !== "function") {

            self.postMessage({
                type: "error",
                message:
                    "unixCryptTD unavailable"
            });

            return;
        }

        /*
         * 前の検索を完全に無効化
         */
        running = false;
        searchToken++;

        const token = searchToken;

        running = true;

        search(data, token);

        return;
    }
};


/* =========================================
   Trip生成
========================================= */

function makeTrip(key) {

    if (typeof crypt !== "function") {

        throw new Error(
            "unixCryptTD unavailable"
        );
    }

    key = String(key);

    /*
     * unix crypt は先頭2文字をsaltに使用
     */
    let salt =
        key.substring(0, 2);

    if (salt.length < 2) {

        salt =
            (salt + "AA")
                .substring(0, 2);
    }

    const result =
        crypt(key, salt);

    if (typeof result !== "string") {

        throw new Error(
            "crypt結果が文字列ではありません"
        );
    }

    /*
     * unix crypt のsalt 2文字を除外。
     *
     * 10桁:
     *   先頭10文字を使用
     *
     * 12桁:
     *   先頭12文字を使用
     *
     * 実際の検索側で照合長を調整する。
     */
    return result.substring(2);
}


/* =========================================
   検索
========================================= */

function search(data, token) {

    /*
     * 10 / 12
     */
    const length =
        Number(data.length) === 12
            ? 12
            : 10;


    /*
     * 条件
     */
    const conditions =
        Array.isArray(data.conditions)
            ? data.conditions
            : [];


    /*
     * 特殊条件
     */
    const special =
        data.special || "none";


    /*
     * 複雑文字セット
     *
     * 英大文字
     * 英小文字
     * 数字
     * . /
     * 記号
     */
    const charset =
        data.charset ||
        "ABCDEFGHIJKLMNOPQRSTUVWXYZ" +
        "abcdefghijklmnopqrstuvwxyz" +
        "0123456789" +
        "./!@#$%^&*()_+-=[]{};:,.<>?";


    /*
     * 1回のイベントループで処理する数
     *
     * 大きすぎると停止が遅くなる。
     * 小さすぎると速度が落ちる。
     */
    const BATCH_SIZE = 256;


    let count = 0;

    /*
     * setTimeoutをキャンセルするためのID
     */
    let timer = null;


    function runBatch() {

        /*
         * stopされた場合
         */
        if (
            !running ||
            token !== searchToken
        ) {

            if (timer !== null) {

                clearTimeout(timer);
                timer = null;
            }

            self.postMessage({
                type: "stopped"
            });

            return;
        }


        let localCount = 0;


        try {

            while (
                localCount < BATCH_SIZE &&
                running &&
                token === searchToken
            ) {

                /*
                 * ランダムキー
                 *
                 * 同じ文字の連続を避ける
                 */
                const key =
                    randomKey(
                        charset,
                        length
                    );


                /*
                 * Trip生成
                 */
                const fullTrip =
                    makeTrip(key);


                /*
                 * 10桁なら10文字
                 * 12桁なら12文字
                 */
                const trip =
                    fullTrip.substring(
                        0,
                        length
                    );


                count++;
                localCount++;


                /*
                 * 条件判定
                 */
                if (
                    matchesConditions(
                        trip,
                        conditions
                    ) &&
                    matchesSpecial(
                        trip,
                        special
                    )
                ) {

                    self.postMessage({
                        type: "hit",
                        key: key,
                        trip: trip
                    });
                }
            }


            /*
             * 2048回ごと
             */
            if (
                (count & 2047) === 0
            ) {

                self.postMessage({
                    type: "progress",
                    count: 2048
                });
            }


        } catch (e) {

            running = false;

            self.postMessage({
                type: "error",
                message:
                    e && e.stack
                        ? e.stack
                        : String(e)
            });

            self.postMessage({
                type: "stopped"
            });

            return;
        }


        /*
         * ここが重要。
         *
         * setTimeoutでイベントループに戻す。
         *
         * これによって
         *
         * stop
         *
         * のonmessageが実行可能になる。
         */
        if (
            running &&
            token === searchToken
        ) {

            timer =
                setTimeout(
                    runBatch,
                    0
                );

        } else {

            self.postMessage({
                type: "stopped"
            });
        }
    }


    runBatch();
}


/* =========================================
   ランダムキー生成
========================================= */

function randomKey(charset, length) {

    const result = [];

    const size =
        charset.length;


    if (size < 2) {

        throw new Error(
            "charsetには2文字以上必要です"
        );
    }


    /*
     * crypto.getRandomValuesを使用
     */
    const buffer =
        new Uint8Array(256);


    let previous = null;


    while (
        result.length < length
    ) {

        crypto.getRandomValues(
            buffer
        );


        for (
            let i = 0;
            i < buffer.length &&
            result.length < length;
            i++
        ) {

            const index =
                buffer[i] % size;


            const char =
                charset[index];


            /*
             * 同じ文字の連続を禁止
             *
             * 例:
             *
             * aaaaa
             * !!!! 
             * ..... 
             *
             * のようなキーを避ける。
             */
            if (
                previous !== null &&
                char === previous
            ) {
                continue;
            }


            result.push(char);

            previous = char;
        }
    }


    return result.join("");
}


/* =========================================
   通常条件
========================================= */

function matchesConditions(
    trip,
    conditions
) {

    for (
        const condition
        of conditions
    ) {

        if (!condition) {
            continue;
        }


        const text =
            String(
                condition.text || ""
            );


        if (!text) {
            continue;
        }


        /*
         * 正規表現
         */
        if (condition.regex) {

            try {

                const re =
                    new RegExp(text);

                if (!re.test(trip)) {

                    return false;
                }

            } catch (e) {

                return false;
            }

            continue;
        }


        const mode =
            condition.mode ||
            "contains";


        if (
            mode === "contains" &&
            !trip.includes(text)
        ) {

            return false;
        }


        if (
            mode === "starts" &&
            !trip.startsWith(text)
        ) {

            return false;
        }


        if (
            mode === "ends" &&
            !trip.endsWith(text)
        ) {

            return false;
        }


        if (
            mode === "exact" &&
            trip !== text
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   特殊トリップ
========================================= */

function matchesSpecial(
    s,
    type
) {

    switch (type) {

        case "none":
        case "":
            return true;


        case "pure":
            return pureN(s);


        case "quasi":
            return quasiN(s);


        case "two":
            return twoKind(s);


        case "longest":
            return /^[MmW]+$/.test(s);


        case "shortest":
            return /^[li.]+$/.test(s);


        case "yakumo":
            return yakumo(s);


        case "mirror":
            return mirror(s);


        case "palindrome":
            return palindrome(s);


        case "echo":
            return echo(s);


        case "double":
            return doublePair(s);


        case "numbers":
            return numbers(s);


        case "tobiishi":
            return tobiishi(s);


        case "kakutobi":
            return kakutobi(s);


        default:
            return true;
    }
}


/* =========================================
   純n連
========================================= */

function pureN(s) {

    let count = 1;

    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i] ===
            s[i - 1]
        ) {

            count++;

            if (count >= 8) {
                return true;
            }

        } else {

            count = 1;
        }
    }

    return false;
}


/* =========================================
   準n連
========================================= */

function quasiN(s) {

    let count = 1;

    for (
        let i = 1;
        i < s.length;
        i++
    ) {

        if (
            s[i].toLowerCase() ===
            s[i - 1].toLowerCase()
        ) {

            count++;

            if (count >= 9) {
                return true;
            }

        } else {

            count = 1;
        }
    }

    return false;
}


/* =========================================
   二構
========================================= */

function twoKind(s) {

    return new Set(s).size <= 2;
}


/* =========================================
   八雲
========================================= */

function yakumo(s) {

    if (s.length < 6) {
        return false;
    }

    const groups =
        Math.floor(
            s.length / 3
        );


    if (groups < 2) {
        return false;
    }


    for (
        let i = 0;
        i < groups * 3;
        i += 3
    ) {

        if (
            s[i] !== s[i + 1] ||
            s[i] !== s[i + 2]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   鏡
========================================= */

function mirror(s) {

    const pair = {

        ".": ".",
        "0": "0",
        "8": "8",

        "A": "A",
        "H": "H",
        "I": "I",
        "M": "M",
        "O": "O",
        "T": "T",
        "U": "U",
        "V": "V",
        "W": "W",
        "X": "X",
        "Y": "Y",

        "b": "d",
        "d": "b",

        "i": "i",
        "l": "l",
        "o": "o",

        "p": "q",
        "q": "p",

        "v": "v",
        "w": "w"
    };


    for (
        let i = 0;
        i < s.length;
        i++
    ) {

        const left =
            s[i];


        const right =
            s[
                s.length -
                1 -
                i
            ];


        if (
            pair[left] !== right
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   回文
========================================= */

function palindrome(s) {

    for (
        let i = 0;
        i < Math.floor(
            s.length / 2
        );
        i++
    ) {

        if (
            s[i] !==
            s[
                s.length -
                1 -
                i
            ]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   山彦
========================================= */

function echo(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    const half =
        s.length / 2;


    return (
        s.substring(
            0,
            half
        ) ===
        s.substring(
            half
        )
    );
}


/* =========================================
   双連
========================================= */

function doublePair(s) {

    if (
        s.length % 2 !== 0
    ) {

        return false;
    }


    for (
        let i = 0;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !==
            s[i + 1]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   全数
========================================= */

function numbers(s) {

    return /^[0-9]+$/.test(s);
}


/* =========================================
   飛石
========================================= */

function tobiishi(s) {

    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !== "." &&
            s[i] !== "/"
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================
   拡飛
========================================= */

function kakutobi(s) {

    if (s.length < 2) {
        return false;
    }


    const separator =
        s[1];


    if (
        separator !== "." &&
        separator !== "/"
    ) {

        return false;
    }


    for (
        let i = 1;
        i < s.length;
        i += 2
    ) {

        if (
            s[i] !== separator
        ) {

            return false;
        }
    }


    return true;
}
