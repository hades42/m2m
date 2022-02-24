import fs from "fs";
import { exit } from "process";
import fetch from "node-fetch";
import TurndownService from "turndown";
import ora from "ora";

export function cli(args) {
    const myArgs = args.slice(2);
    let mainID;

    const processedURL = (URL) => {
        return URL.split("/");
    };

    const fetchURL = async (URL) => {
        const currURL = processedURL(URL);

        const found = currURL.findIndex((el) => el === "medium.com");

        let feedURL =
            found > -1
                ? `${currURL[0]}//${currURL[2]}/feed/${currURL[3]}`
                : `${currURL[0]}//${currURL[2]}/feed`;

        mainID = found > -1 ? currURL[4] : currURL[3];

        const getJSONFormat = await fetch(
            `https://api.rss2json.com/v1/api.json?rss_url=${feedURL}`
        );
        const text = await getJSONFormat.text();
        const json = JSON.parse(text);
        return json;
    };

    const convertToMD = async () => {
        const feed = await fetchURL(myArgs[0]);
        let mainContent;
        let flag = false;

        for (const item of feed.items) {
            const processLink = processedURL(item.link.split("?")[0]);
            for (const li of processLink) {
                if (li === mainID) {
                    mainContent = item;
                    flag = true;
                    break;
                }
            }
        }

        return new Promise((resolve, rejects) => {
            if (!flag) {
                rejects("This is a preimum post!");
            } else {
                const turndownService = new TurndownService();
                const markdownContent = turndownService.turndown(
                    mainContent.content
                );
                const frontmatter = `
---
firstPublishedAt: ${mainContent.pubDate}
slug: ${mainContent.link}
thumbnail: ${mainContent.thumbnail}
author: ${mainContent.author} 
title: ${mainContent.title}
tags: [${mainContent.categories}]
---\n\n`;

                resolve(frontmatter + markdownContent);
            }
        });
    };

    const main = async () => {
        if (myArgs.length < 1 || myArgs.length > 2) {
            console.log("Usage: m2m <Medium_URL>");
            process.exit(1);
        }
        const spinners = ora("Converting File\n").start();
        const content = await convertToMD().catch((error) => {
            spinners.fail(error);
            exit(1);
        });
        const currDir = process.cwd() + "/posts";

        //Create a /posts folder at current Dir
        try {
            if (!fs.existsSync(currDir)) {
                fs.mkdirSync(currDir);
            }
        } catch (error) {
            spinners.fail(error);
        }

        // write to the file
        const fileName = mainID + ".md";
        fs.writeFileSync(`${currDir}/${fileName}`, content, (err) => {
            spinners.fail(err);
        });

        spinners.succeed("Successfully create .md file");
    };
    main();
}
