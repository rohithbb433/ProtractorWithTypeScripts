import { browser, by, element } from "protractor";
import { ExpectedConditions } from "protractor";

describe("Window Handles", () => {
    it("Testing New Window", async () => {
        browser.ignoreSynchronization = true;
        await browser.get("http://demo.automationtesting.in/Windows.html");
        browser.sleep(5000);
        await element(by.xpath("//a[text()='Open New Tabbed Windows ']")).click();
        browser.sleep(5000);
        await element(by.buttonText("click")).click();
        browser.sleep(5000);

        browser.getAllWindowHandles().then(value => {
            for (let win of value) {
                browser.switchTo().window(win);
                browser.getTitle().then(value1 => {
                    console.log(value1);
                })
            }
        })

    })
})