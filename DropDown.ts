import { browser, by, element } from "protractor";
import { ExpectedConditions } from "protractor";
//import path from "path";

describe("Window Handles", () => {
    it("Testing New Window", async () => {
        browser.ignoreSynchronization = true;
        await browser.manage().timeouts().implicitlyWait(10000);
        await browser.get("https://www.sendgb.com/");
        await browser.manage().window().maximize();
        let elm = await element(by.xpath("//input[@name='qqfile']"));
        await browser.sleep(10000);

        //await browser.executeScript("arguments[0].click();", await elm.getWebElement());

        // await browser.sleep(10000);

        // var fileToUpload = await 'C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png',
        //     absolutePath = await path.resolve(__dirname, fileToUpload);

        // console.log("**********" + fileToUpload);
        //C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png
        await elm.sendKeys("C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png");
        await browser.sleep(5000);

        // await browser.executeScript("document.getElementById('uploadAdmore').value='C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png';");

    })
})