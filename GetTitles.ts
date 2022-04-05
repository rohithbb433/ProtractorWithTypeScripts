import { browser, element, by } from "protractor";

describe('Wait', () => {
    it('Verify', async () => {
        browser.ignoreSynchronization = true;
        await browser.get('http://demo.automationtesting.in/Frames.html');

        await browser.getTitle().then(value => {
            console.log(value + '**********************');
        })


        console.log('**********************');

    });
});