"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const protractor_1 = require("protractor");
//import path from "path";
describe("Window Handles", () => {
    it("Testing New Window", () => __awaiter(void 0, void 0, void 0, function* () {
        protractor_1.browser.ignoreSynchronization = true;
        yield protractor_1.browser.manage().timeouts().implicitlyWait(10000);
        yield protractor_1.browser.get("https://www.sendgb.com/");
        yield protractor_1.browser.manage().window().maximize();
        let elm = yield (0, protractor_1.element)(protractor_1.by.xpath("//input[@name='qqfile']"));
        yield protractor_1.browser.sleep(10000);
        //await browser.executeScript("arguments[0].click();", await elm.getWebElement());
        // await browser.sleep(10000);
        // var fileToUpload = await 'C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png',
        //     absolutePath = await path.resolve(__dirname, fileToUpload);
        // console.log("**********" + fileToUpload);
        //C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png
        yield elm.sendKeys("C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png");
        yield protractor_1.browser.sleep(5000);
        // await browser.executeScript("document.getElementById('uploadAdmore').value='C:/Users/rohith/Documents/JavaScripts/ProtractorWithTypeScript/JSFile/allure-results/demo.png';");
    }));
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiRHJvcERvd24uanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9Ecm9wRG93bi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7OztBQUFBLDJDQUFrRDtBQUVsRCwwQkFBMEI7QUFFMUIsUUFBUSxDQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRTtJQUM1QixFQUFFLENBQUMsb0JBQW9CLEVBQUUsR0FBUyxFQUFFO1FBQ2hDLG9CQUFPLENBQUMscUJBQXFCLEdBQUcsSUFBSSxDQUFDO1FBQ3JDLE1BQU0sb0JBQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxjQUFjLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDeEQsTUFBTSxvQkFBTyxDQUFDLEdBQUcsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQzdDLE1BQU0sb0JBQU8sQ0FBQyxNQUFNLEVBQUUsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUMzQyxJQUFJLEdBQUcsR0FBRyxNQUFNLElBQUEsb0JBQU8sRUFBQyxlQUFFLENBQUMsS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUMsQ0FBQztRQUM3RCxNQUFNLG9CQUFPLENBQUMsS0FBSyxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTNCLGtGQUFrRjtRQUVsRiw4QkFBOEI7UUFFOUIsNEhBQTRIO1FBQzVILGtFQUFrRTtRQUVsRSw0Q0FBNEM7UUFDNUMsK0ZBQStGO1FBQy9GLE1BQU0sR0FBRyxDQUFDLFFBQVEsQ0FBQywrRkFBK0YsQ0FBQyxDQUFDO1FBQ3BILE1BQU0sb0JBQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFFMUIsaUxBQWlMO0lBRXJMLENBQUMsQ0FBQSxDQUFDLENBQUE7QUFDTixDQUFDLENBQUMsQ0FBQSJ9