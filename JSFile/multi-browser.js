"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.config = {
    directConnect: true,
    // Capabilities to be passed to the webdriver instance.
    multiCapabilities: [
        {
            "browserName": "chrome"
        }
        ,
        {
            "browserName": "firefox"
        }
    ],
    // Framework to use. Jasmine is recommended.
    framework: 'jasmine',
    // Spec patterns are relative to the current working directory when
    // protractor is called.
    specs: ['./WindowHundles.js']
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29uZi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uL2NvbmYudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBRVcsUUFBQSxNQUFNLEdBQVc7SUFDeEIsYUFBYSxFQUFFLElBQUk7SUFFbkIsdURBQXVEO0lBQ3ZELFlBQVksRUFBRTtRQUNWLGFBQWEsRUFBRSxRQUFRO1FBQ3ZCLG1CQUFtQjtRQUNuQiwyQkFBMkI7UUFDM0IsSUFBSTtLQUNQO0lBRUQsNENBQTRDO0lBQzVDLFNBQVMsRUFBRSxTQUFTO0lBRXBCLG1FQUFtRTtJQUNuRSx3QkFBd0I7SUFFeEIsS0FBSyxFQUFFLENBQUMsZ0JBQWdCLENBQUM7Q0FFNUIsQ0FBQyJ9