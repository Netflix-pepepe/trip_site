"use strict";

/*
 * =========================================================
 * 人狼オンライン トリップ検索 Worker
 *
 * 必要ファイル:
 *   ./unix-crypt-td.min.js
 *
 * 10桁:
 *   2ch系 Unix crypt
 *   crypt結果の末尾10文字
 *
 * 12桁:
 *   SHA-1 -> Base64 -> 先頭12文字
 *
 * 検索:
 *   既存のランダム検索方式を維持
 * =========================================================
 */

let crypt = null;
let running = false;


/* =========================================================
   初期化
========================================================= */

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


/* =========================================================
   メッセージ
========================================================= */

self.onmessage = function (event) {

    const data =
        event.data || {};

    if (data.type === "stop") {

        running = false;

        self.postMessage({
            type: "stopped"
        });

        return;
    }


    if (data.type === "test") {

        runTests();

        return;
    }


    if (data.type === "generate") {

        try {

            const length =
                Number(data.length) === 12
                    ? 12
                    : 10;

            const key =
                String(
                    data.key || ""
                );

            const trip =
                makeTrip(
                    key,
                    length
                );

            self.postMessage({
                type: "generate-result",
                key: key,
                trip: trip,
                length: length
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


    if (data.type === "search") {

        if (
            typeof crypt !==
            "function"
        ) {

            self.postMessage({
                type: "error",
                message:
                    "unixCryptTD unavailable"
            });

            return;
        }

        running = true;

        search(data);

        return;
    }
};


/* =========================================================
   トリップ生成
========================================================= */

function makeTrip(
    key,
    length
) {

    if (
        typeof crypt !==
        "function"
    ) {

        throw new Error(
            "unixCryptTD unavailable"
        );
    }


    key =
        String(key);


    /*
     * # が渡された場合は除去
     */
    if (
        key.charAt(0) === "#"
    ) {

        key =
            key.substring(1);
    }


    /*
     * =====================================================
     * 10桁
     *
     * #aaaaaaaa
     *
     * 10桁方式では先頭8バイトだけ使用。
     *
     * salt:
     *   key[1] + key[2]
     *
     * ただし salt に使用できない文字は
     * 2ch方式に合わせて変換する。
     * =====================================================
     */

    if (
        Number(length) !== 12
    ) {

        const password =
            key.substring(
                0,
                8
            );


        /*
         * #aaaaaaaa
         *
         * salt は
         * 2文字目・3文字目
         *
         * Perl相当:
         *
         * $salt = substr($key . 'H.', 1, 2)
         * $salt =~ s/[^\.-z]/\./g
         * $salt =~ tr/:;<=>?@[\\]^_`/ABCDEFGabcdef/
         *
         * keyだけの文字列に変換して処理する。
         */

        let saltSource =
            (
                key + "H."
            ).substring(
                1,
                3
            );


        saltSource =
            saltSource.replace(
                /[^\.-z]/g,
                "."
            );


        const from =
            ":;<=>?@[\\]^_`";

        const to =
            "ABCDEFGabcdef";


        let salt = "";

        for (
            let i = 0;
            i < saltSource.length;
            i++
        ) {

            const ch =
                saltSource.charAt(i);

            const pos =
                from.indexOf(ch);

            if (pos >= 0) {

                salt +=
                    to.charAt(pos);

            } else {

                salt += ch;
            }
        }


        /*
         * 念のため2文字にする
         */
        if (
            salt.length < 2
        ) {

            salt =
                (
                    salt + "H."
                ).substring(
                    0,
                    2
                );
        }


        const result =
            crypt(
                password,
                salt
            );


        if (
            typeof result !==
            "string"
        ) {

            throw new Error(
                "crypt結果が文字列ではありません"
            );
        }


        /*
         * ★重要
         *
         * crypt() は
         *
         *   salt 2文字
         *   + 暗号化結果11文字
         *
         * の13文字。
         *
         * 2chの10桁トリップは
         * 「先頭2文字を除いて10文字」
         * ではなく、実質的に
         * crypt結果の末尾10文字を使用。
         *
         * 例:
         *
         * aaaaaaaa
         * -> aacR08PK3l1o
         * -> cR08PK3l1o
         */

        return result.slice(
            -10
        );
    }


    /*
     * =====================================================
     * 12桁
     *
     * キー全体をSHA-1
     * ↓
     * Base64
     * ↓
     * 先頭12文字
     *
     * generateでは同期化できないため
     * makeTripAsyncを使用する。
     * この関数は検索以外では呼ばれない。
     * =====================================================
     */

    throw new Error(
        "12桁は makeTripAsync() を使用してください"
    );
}


/* =========================================================
   12桁生成
========================================================= */

async function makeTripAsync(
    key
) {

    key =
        String(key);


    if (
        key.charAt(0) === "#"
    ) {

        key =
            key.substring(1);
    }


    const data =
        new TextEncoder()
            .encode(key);


    const digest =
        await crypto.subtle.digest(
            "SHA-1",
            data
        );


    const bytes =
        new Uint8Array(
            digest
        );


    let binary = "";

    for (
        let i = 0;
        i < bytes.length;
        i++
    ) {

        binary +=
            String.fromCharCode(
                bytes[i]
            );
    }


    const base64 =
        btoa(binary);


    return base64.substring(
        0,
        12
    );
}


/* =========================================================
   テスト
========================================================= */

async function runTests() {

    try {

        const tests = [
            {
                key: "foob",
                length: 10
            },
            {
                key: "Jim",
                length: 10
            },
            {
                key: "aaaaaaaa",
                length: 10
            },
            {
                key: "test",
                length: 10
            }
        ];


        const results = [];


        for (
            const test of tests
        ) {

            const trip =
                makeTrip(
                    test.key,
                    10
                );

            results.push({
                key: test.key,
                trip: trip
            });
        }


        /*
         * 12桁テスト
         */
        const trip12 =
            await makeTripAsync(
                "abcdefghijkl"
            );


        results.push({
            key: "abcdefghijkl",
            trip: trip12,
            length: 12
        });


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
}


/* =========================================================
   検索
========================================================= */

async function search(
    data
) {

    const length =
        Number(data.length) === 12
            ? 12
            : 10;


    const conditions =
        Array.isArray(
            data.conditions
        )
            ? data.conditions
            : [];


    const special =
        data.special ||
        "none";


    const charset =
        data.charset ||
        "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789./";


    let count = 0;


    /*
     * 12桁はSHA-1なので非同期。
     *
     * 10桁は従来通り高速同期処理。
     */

    if (
        length === 12
    ) {

        while (running) {

            const key =
                randomKey(
                    charset,
                    12
                );


            let trip;

            try {

                trip =
                    await makeTripAsync(
                        key
                    );

            } catch (e) {

                self.postMessage({
                    type: "error",
                    message:
                        e && e.message
                            ? e.message
                            : String(e)
                });

                running =
                    false;

                return;
            }


            count++;


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


            if (
                (count & 2047) === 0
            ) {

                self.postMessage({
                    type: "progress",
                    count: 2048
                });

                /*
                 * UIへ制御を返す
                 */
                await Promise.resolve();
            }
        }


        self.postMessage({
            type: "stopped"
        });

        return;
    }


    /*
     * =====================================================
     * 10桁検索
     * =====================================================
     */

    while (running) {

        const key =
            randomKey(
                charset,
                8
            );


        let trip;


        try {

            trip =
                makeTrip(
                    key,
                    10
                );

        } catch (e) {

            self.postMessage({
                type: "error",
                message:
                    e && e.message
                        ? e.message
                        : String(e)
            });

            running =
                false;

            return;
        }


        count++;


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


        if (
            (count & 2047) === 0
        ) {

            self.postMessage({
                type: "progress",
                count: 2048
            });
        }
    }


    self.postMessage({
        type: "stopped"
    });
}


/* =========================================================
   ランダムキー
========================================================= */

function randomKey(
    charset,
    length
) {

    const result = [];

    const size =
        charset.length;


    const max =
        256 -
        (
            256 % size
        );


    while (
        result.length <
        length
    ) {

        const buffer =
            new Uint8Array(
                64
            );


        crypto.getRandomValues(
            buffer
        );


        for (
            let i = 0;
            i < buffer.length &&
            result.length < length;
            i++
        ) {

            const value =
                buffer[i];


            if (
                value >= max
            ) {

                continue;
            }


            result.push(
                charset[
                    value % size
                ]
            );
        }
    }


    return result.join("");
}


/* =========================================================
   通常条件
========================================================= */

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


        if (
            condition.regex
        ) {

            try {

                const re =
                    new RegExp(
                        text
                    );


                if (
                    !re.test(trip)
                ) {

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


/* =========================================================
   特殊トリップ
========================================================= */

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


/* =========================================================
   純n連
========================================================= */

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


            if (
                count >= 8
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================================
   準n連
========================================================= */

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


            if (
                count >= 9
            ) {

                return true;
            }

        } else {

            count = 1;
        }
    }


    return false;
}


/* =========================================================
   二構
========================================================= */

function twoKind(s) {

    return new Set(s).size <= 2;
}


/* =========================================================
   八雲
========================================================= */

function yakumo(s) {

    if (
        s.length < 6
    ) {

        return false;
    }


    const groups =
        Math.floor(
            s.length / 3
        );


    if (
        groups < 2
    ) {

        return false;
    }


    for (
        let i = 0;
        i < groups * 3;
        i += 3
    ) {

        if (
            s[i] !==
            s[i + 1] ||
            s[i] !==
            s[i + 2]
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   鏡
========================================================= */

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
            pair[left] !==
            right
        ) {

            return false;
        }
    }


    return true;
}


/* =========================================================
   回文
========================================================= */

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


/* =========================================================
   山彦
========================================================= */

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


/* =========================================================
   双連
========================================================= */

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


/* =========================================================
   全数
========================================================= */

function numbers(s) {

    return /^[0-9]+$/.test(s);
}


/* =========================================================
   飛石
========================================================= */

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


/* =========================================================
   拡飛
========================================================= */

function kakutobi(s) {

    if (
        s.length < 2
    ) {

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
            s[i] !==
            separator
        ) {

            return false;
        }
    }


    return true;
}
