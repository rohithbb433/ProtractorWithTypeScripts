var app = angular.module('reportingApp', []);

//<editor-fold desc="global helpers">

var isValueAnArray = function (val) {
    return Array.isArray(val);
};

var getSpec = function (str) {
    var describes = str.split('|');
    return describes[describes.length - 1];
};
var checkIfShouldDisplaySpecName = function (prevItem, item) {
    if (!prevItem) {
        item.displaySpecName = true;
    } else if (getSpec(item.description) !== getSpec(prevItem.description)) {
        item.displaySpecName = true;
    }
};

var getParent = function (str) {
    var arr = str.split('|');
    str = "";
    for (var i = arr.length - 2; i > 0; i--) {
        str += arr[i] + " > ";
    }
    return str.slice(0, -3);
};

var getShortDescription = function (str) {
    return str.split('|')[0];
};

var countLogMessages = function (item) {
    if ((!item.logWarnings || !item.logErrors) && item.browserLogs && item.browserLogs.length > 0) {
        item.logWarnings = 0;
        item.logErrors = 0;
        for (var logNumber = 0; logNumber < item.browserLogs.length; logNumber++) {
            var logEntry = item.browserLogs[logNumber];
            if (logEntry.level === 'SEVERE') {
                item.logErrors++;
            }
            if (logEntry.level === 'WARNING') {
                item.logWarnings++;
            }
        }
    }
};

var convertTimestamp = function (timestamp) {
    var d = new Date(timestamp),
        yyyy = d.getFullYear(),
        mm = ('0' + (d.getMonth() + 1)).slice(-2),
        dd = ('0' + d.getDate()).slice(-2),
        hh = d.getHours(),
        h = hh,
        min = ('0' + d.getMinutes()).slice(-2),
        ampm = 'AM',
        time;

    if (hh > 12) {
        h = hh - 12;
        ampm = 'PM';
    } else if (hh === 12) {
        h = 12;
        ampm = 'PM';
    } else if (hh === 0) {
        h = 12;
    }

    // ie: 2013-02-18, 8:35 AM
    time = yyyy + '-' + mm + '-' + dd + ', ' + h + ':' + min + ' ' + ampm;

    return time;
};

var defaultSortFunction = function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) {
        return -1;
    } else if (a.sessionId > b.sessionId) {
        return 1;
    }

    if (a.timestamp < b.timestamp) {
        return -1;
    } else if (a.timestamp > b.timestamp) {
        return 1;
    }

    return 0;
};

//</editor-fold>

app.controller('ScreenshotReportController', ['$scope', '$http', 'TitleService', function ($scope, $http, titleService) {
    var that = this;
    var clientDefaults = {};

    $scope.searchSettings = Object.assign({
        description: '',
        allselected: true,
        passed: true,
        failed: true,
        pending: true,
        withLog: true
    }, clientDefaults.searchSettings || {}); // enable customisation of search settings on first page hit

    this.warningTime = 1400;
    this.dangerTime = 1900;
    this.totalDurationFormat = clientDefaults.totalDurationFormat;
    this.showTotalDurationIn = clientDefaults.showTotalDurationIn;

    var initialColumnSettings = clientDefaults.columnSettings; // enable customisation of visible columns on first page hit
    if (initialColumnSettings) {
        if (initialColumnSettings.displayTime !== undefined) {
            // initial settings have be inverted because the html bindings are inverted (e.g. !ctrl.displayTime)
            this.displayTime = !initialColumnSettings.displayTime;
        }
        if (initialColumnSettings.displayBrowser !== undefined) {
            this.displayBrowser = !initialColumnSettings.displayBrowser; // same as above
        }
        if (initialColumnSettings.displaySessionId !== undefined) {
            this.displaySessionId = !initialColumnSettings.displaySessionId; // same as above
        }
        if (initialColumnSettings.displayOS !== undefined) {
            this.displayOS = !initialColumnSettings.displayOS; // same as above
        }
        if (initialColumnSettings.inlineScreenshots !== undefined) {
            this.inlineScreenshots = initialColumnSettings.inlineScreenshots; // this setting does not have to be inverted
        } else {
            this.inlineScreenshots = false;
        }
        if (initialColumnSettings.warningTime) {
            this.warningTime = initialColumnSettings.warningTime;
        }
        if (initialColumnSettings.dangerTime) {
            this.dangerTime = initialColumnSettings.dangerTime;
        }
    }


    this.chooseAllTypes = function () {
        var value = true;
        $scope.searchSettings.allselected = !$scope.searchSettings.allselected;
        if (!$scope.searchSettings.allselected) {
            value = false;
        }

        $scope.searchSettings.passed = value;
        $scope.searchSettings.failed = value;
        $scope.searchSettings.pending = value;
        $scope.searchSettings.withLog = value;
    };

    this.isValueAnArray = function (val) {
        return isValueAnArray(val);
    };

    this.getParent = function (str) {
        return getParent(str);
    };

    this.getSpec = function (str) {
        return getSpec(str);
    };

    this.getShortDescription = function (str) {
        return getShortDescription(str);
    };
    this.hasNextScreenshot = function (index) {
        var old = index;
        return old !== this.getNextScreenshotIdx(index);
    };

    this.hasPreviousScreenshot = function (index) {
        var old = index;
        return old !== this.getPreviousScreenshotIdx(index);
    };
    this.getNextScreenshotIdx = function (index) {
        var next = index;
        var hit = false;
        while (next + 2 < this.results.length) {
            next++;
            if (this.results[next].screenShotFile && !this.results[next].pending) {
                hit = true;
                break;
            }
        }
        return hit ? next : index;
    };

    this.getPreviousScreenshotIdx = function (index) {
        var prev = index;
        var hit = false;
        while (prev > 0) {
            prev--;
            if (this.results[prev].screenShotFile && !this.results[prev].pending) {
                hit = true;
                break;
            }
        }
        return hit ? prev : index;
    };

    this.convertTimestamp = convertTimestamp;


    this.round = function (number, roundVal) {
        return (parseFloat(number) / 1000).toFixed(roundVal);
    };


    this.passCount = function () {
        var passCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.passed) {
                passCount++;
            }
        }
        return passCount;
    };


    this.pendingCount = function () {
        var pendingCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.pending) {
                pendingCount++;
            }
        }
        return pendingCount;
    };

    this.failCount = function () {
        var failCount = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (!result.passed && !result.pending) {
                failCount++;
            }
        }
        return failCount;
    };

    this.totalDuration = function () {
        var sum = 0;
        for (var i in this.results) {
            var result = this.results[i];
            if (result.duration) {
                sum += result.duration;
            }
        }
        return sum;
    };

    this.passPerc = function () {
        return (this.passCount() / this.totalCount()) * 100;
    };
    this.pendingPerc = function () {
        return (this.pendingCount() / this.totalCount()) * 100;
    };
    this.failPerc = function () {
        return (this.failCount() / this.totalCount()) * 100;
    };
    this.totalCount = function () {
        return this.passCount() + this.failCount() + this.pendingCount();
    };


    var results = [
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14856,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Expected '2' to be '4'.",
            "Expected '2' to be '4'."
        ],
        "trace": [
            "Error: Failed expectation\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\WindowHundles.ts:18:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)",
            "Error: Failed expectation\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\WindowHundles.ts:18:33\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)"
        ],
        "browserLogs": [],
        "screenShotFile": "00950082-0080-001c-0011-00fa000400ae.png",
        "timestamp": 1648657226705,
        "duration": 19610
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10424,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"option\", \"+\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"option\", \"+\")\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:9:60\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "004800eb-003d-0040-00e2-006700b700e0.png",
        "timestamp": 1648698725252,
        "duration": 3078
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16936,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: No element found using locator: by.cssContainingText(\"option\", \"+\")"
        ],
        "trace": [
            "NoSuchElementError: No element found using locator: by.cssContainingText(\"option\", \"+\")\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:814:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:9:60\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [],
        "screenShotFile": "00500002-0030-008e-007f-000b007a004a.png",
        "timestamp": 1648698752609,
        "duration": 2651
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 3592,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "security - Error with Permissions-Policy header: Unrecognized feature: 'interest-cohort'.",
                "timestamp": 1648698767946,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://juliemr.github.io/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1648698768298,
                "type": ""
            }
        ],
        "timestamp": 1648698767585,
        "duration": 5816
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 13592,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "security - Error with Permissions-Policy header: Unrecognized feature: 'interest-cohort'.",
                "timestamp": 1648698834704,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://juliemr.github.io/favicon.ico - Failed to load resource: the server responded with a status of 404 ()",
                "timestamp": 1648698834947,
                "type": ""
            }
        ],
        "timestamp": 1648698834625,
        "duration": 5381
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12328,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument: File not found : ./allure-results/allure-results\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument: File not found : ./allure-results/allure-results\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648699762212,
                "type": ""
            }
        ],
        "screenShotFile": "00a100ba-000b-009d-0025-00f700b4000c.png",
        "timestamp": 1648699758821,
        "duration": 5353
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15368,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: unknown error: path is not absolute: ./allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: unknown error: path is not absolute: ./allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648699817481,
                "type": ""
            }
        ],
        "screenShotFile": "00620007-00aa-00c1-009e-00d600cc0070.png",
        "timestamp": 1648699815243,
        "duration": 25389
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 1848,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: unknown error: path is not absolute: ./allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: unknown error: path is not absolute: ./allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648699934544,
                "type": ""
            }
        ],
        "screenShotFile": "00b900d4-001e-0081-00a2-004b005200fa.png",
        "timestamp": 1648699932634,
        "duration": 4803
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15276,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648699961225,
                "type": ""
            }
        ],
        "screenShotFile": "00430016-00fd-0057-00d5-0026000600ad.png",
        "timestamp": 1648699959219,
        "duration": 4948
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7004,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700040334,
                "type": ""
            }
        ],
        "screenShotFile": "00120011-0043-003e-0060-00e5001b00dc.png",
        "timestamp": 1648700038083,
        "duration": 5051
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9252,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700254993,
                "type": ""
            }
        ],
        "screenShotFile": "001500a2-0010-00c2-00f3-00b500010022.png",
        "timestamp": 1648700252654,
        "duration": 5673
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12764,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700354679,
                "type": ""
            }
        ],
        "screenShotFile": "0021006a-00f3-0056-00fd-00c700d3009f.png",
        "timestamp": 1648700352827,
        "duration": 24775
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 17252,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700419657,
                "type": ""
            }
        ],
        "screenShotFile": "00d6000e-00d9-0041-0075-00610084003d.png",
        "timestamp": 1648700417788,
        "duration": 5891
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 16144,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument: File not found : C:Users\rohithDocumentsJavaScriptsProtractorWithTypeScriptJSFileallure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:10:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:4:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700507185,
                "type": ""
            }
        ],
        "screenShotFile": "00d000dc-00f2-00fe-003c-005200c000c9.png",
        "timestamp": 1648700504764,
        "duration": 4626
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18364,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.click()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:12:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700563305,
                "type": ""
            }
        ],
        "screenShotFile": "00710078-000f-000d-008b-003f002d0047.png",
        "timestamp": 1648700561351,
        "duration": 3903
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 8,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700628054,
                "type": ""
            }
        ],
        "timestamp": 1648700626186,
        "duration": 23275
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9300,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: invalid argument\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: invalid argument\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.click()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.click (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2092:17)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as click] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:12:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700685755,
                "type": ""
            }
        ],
        "screenShotFile": "00da0044-0018-008b-0037-00c1005a00bb.png",
        "timestamp": 1648700683556,
        "duration": 14789
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10148,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700873751,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "javascript 2 File chooser dialog can only be shown with a user activation.",
                "timestamp": 1648700886698,
                "type": ""
            }
        ],
        "screenShotFile": "00240072-007a-0086-0028-0057000600db.png",
        "timestamp": 1648700872010,
        "duration": 34726
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18936,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648700995710,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "javascript 2 File chooser dialog can only be shown with a user activation.",
                "timestamp": 1648701008437,
                "type": ""
            }
        ],
        "screenShotFile": "0020006b-0080-00ef-0076-00b100db00ea.png",
        "timestamp": 1648700993886,
        "duration": 34590
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 15516,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648701155365,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "javascript 2 File chooser dialog can only be shown with a user activation.",
                "timestamp": 1648701168129,
                "type": ""
            }
        ],
        "screenShotFile": "00fa0043-005e-0046-007b-000b00c60029.png",
        "timestamp": 1648701153624,
        "duration": 34538
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 12336,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: Angular could not be found on the page https://www.sendgb.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load"
        ],
        "trace": [
            "Error: Angular could not be found on the page https://www.sendgb.com/. If this is not an Angular application, you may need to turn off waiting for Angular.\n                          Please see \n                          https://github.com/angular/protractor/blob/master/docs/timeouts.md#waiting-for-angular-on-page-load\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\browser.js:718:27\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:668:7\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648701229765,
                "type": ""
            }
        ],
        "screenShotFile": "008e00a3-00c2-008a-0010-005c005c0045.png",
        "timestamp": 1648701227759,
        "duration": 15080
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10496,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648701294388,
                "type": ""
            },
            {
                "level": "WARNING",
                "message": "javascript 2 File chooser dialog can only be shown with a user activation.",
                "timestamp": 1648701306158,
                "type": ""
            }
        ],
        "screenShotFile": "009f000a-0029-0083-005d-00a5002000ec.png",
        "timestamp": 1648701292217,
        "duration": 33985
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 10768,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648701702766,
                "type": ""
            }
        ],
        "screenShotFile": "00a500f2-00b8-0081-002e-004f00a300d9.png",
        "timestamp": 1648701700711,
        "duration": 35786
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9796,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648701873962,
                "type": ""
            }
        ],
        "screenShotFile": "00440004-00c6-0066-00c3-00dc00390035.png",
        "timestamp": 1648701872092,
        "duration": 34800
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18548,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648701997488,
                "type": ""
            }
        ],
        "screenShotFile": "006c0035-00ba-0099-00fc-00ae005400cc.png",
        "timestamp": 1648701995710,
        "duration": 34056
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 18780,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648702108108,
                "type": ""
            }
        ],
        "screenShotFile": "00d500c0-00b5-0009-00f4-00310088001a.png",
        "timestamp": 1648702106180,
        "duration": 35278
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 19496,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648702386809,
                "type": ""
            }
        ],
        "screenShotFile": "00ee00d8-00da-00fe-0063-003c00120060.png",
        "timestamp": 1648702384446,
        "duration": 34167
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 19740,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702694588' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702695832,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702694588 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702695833,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702694597' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702695833,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702694597 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702695838,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ps.eyeota.net/match/bounce/?gdpr=0&gdpr_consent=&bid=1mpr7m0&r=https%3A%2F%2Fid5-sync.com%2Fc%2F464%2F123%2F1%2F7.gif%3Fpuid%3D%7BUUID%7D%26gdpr%3D0%26gdpr_consent%3D - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702719531,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sync.crwdcntrl.net/map/ct=y/c=13953/tp=IDFI/gdpr=0/gdpr_consent=?https://id5-sync.com/c/464/19/0/8.gif?puid=${profile_id}&gdpr=0&gdpr_consent= - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702719531,
                "type": ""
            }
        ],
        "screenShotFile": "008d0087-0067-0015-00b4-00ab006400e7.png",
        "timestamp": 1648702692026,
        "duration": 37658
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 7208,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702745681' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702746444,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702745681 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702746444,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702745698' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702746444,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702745698 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702746444,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ps.eyeota.net/match/bounce/?gdpr=0&gdpr_consent=&bid=1mpr7m0&r=https%3A%2F%2Fid5-sync.com%2Fc%2F464%2F123%2F1%2F7.gif%3Fpuid%3D%7BUUID%7D%26gdpr%3D0%26gdpr_consent%3D - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702766751,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sync.crwdcntrl.net/map/ct=y/c=13953/tp=IDFI/gdpr=0/gdpr_consent=?https://id5-sync.com/c/464/19/0/8.gif?puid=${profile_id}&gdpr=0&gdpr_consent= - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702766751,
                "type": ""
            }
        ],
        "screenShotFile": "0039005c-00a8-000b-0021-00220025001a.png",
        "timestamp": 1648702743794,
        "duration": 33078
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 5268,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL."
        ],
        "trace": [
            "Error: Timeout - Async callback was not invoked within timeout specified by jasmine.DEFAULT_TIMEOUT_INTERVAL.\n    at Timeout._onTimeout (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4281:23)\n    at listOnTimeout (node:internal/timers:559:17)\n    at processTimers (node:internal/timers:502:7)"
        ],
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702847289' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702848050,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702847289 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702848051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702847297' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702848051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702847297 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702848051,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://match.adsrvr.org/track/cmf/generic?ttd_pid=054f32o&ttd_tpi=1 - Failed to load resource: the server responded with a status of 503 ()",
                "timestamp": 1648702868240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://match.adsrvr.org/track/cmb/generic?ttd_pid=054f32o&ttd_tpi=1 - Failed to load resource: the server responded with a status of 503 ()",
                "timestamp": 1648702868240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ps.eyeota.net/match?gdpr=0&gdpr_consent=&bid=1mpr7m0&r=https%3A%2F%2Fid5-sync.com%2Fc%2F464%2F123%2F1%2F7.gif%3Fpuid%3D%7BUUID%7D%26gdpr%3D0%26gdpr_consent%3D - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702868240,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sync.crwdcntrl.net/map/c=13953/tp=IDFI/gdpr=0/gdpr_consent=?https://id5-sync.com/c/464/19/0/8.gif?puid=${profile_id}&gdpr=0&gdpr_consent= - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702868240,
                "type": ""
            }
        ],
        "screenShotFile": "00e00089-00f2-00e8-0085-000300cf004f.png",
        "timestamp": 1648702845746,
        "duration": 32655
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21428,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702941868' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702942666,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702941868 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702942667,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702942039' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702942669,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702942039 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702942671,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://ps.eyeota.net/match/bounce/?gdpr=0&gdpr_consent=&bid=1mpr7m0&r=https%3A%2F%2Fid5-sync.com%2Fc%2F464%2F123%2F1%2F7.gif%3Fpuid%3D%7BUUID%7D%26gdpr%3D0%26gdpr_consent%3D - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702953200,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://sync.crwdcntrl.net/map/ct=y/c=13953/tp=IDFI/gdpr=0/gdpr_consent=?https://id5-sync.com/c/464/19/0/8.gif?puid=${profile_id}&gdpr=0&gdpr_consent= - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648702953200,
                "type": ""
            }
        ],
        "timestamp": 1648702940478,
        "duration": 12866
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 21380,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702996100' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702996809,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22top%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-a&position=top&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702996100 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702996809,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://tus.io/demo.html - Access to XMLHttpRequest at 'https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702996112' from origin 'https://tus.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present on the requested resource.",
                "timestamp": 1648702996812,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://reporting.services.disqus.com/_log/taboola?placement=%7B%22domain%22%3A%20%22https%3A%2F%2Ftus.io%22%2C%20%22experiment%22%3A%20%22network_default%22%2C%20%22position%22%3A%20%22bottom%22%2C%20%22shortname%22%3A%20%22tusio%22%2C%20%22variant%22%3A%20%22fallthrough%22%7D&is_taboola_named=false&language=en&colorscheme=light&typeface=sans-serif&variant=fallthrough&forum_id=2278359&source_url=https%3A%2F%2Ftus.io%2Fdemo.html&organization_id=1773899&taboola_publisher_name=disqus-widget-safetylevel20longtail09&experiment=network_default&mode=thumbnails-b&position=bottom&shortname=tusio&referrer_url=https%3A%2F%2Ftus.io%2F&canonical_url&1648702996112 - Failed to load resource: net::ERR_FAILED",
                "timestamp": 1648702996812,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://id5-sync.com/c/464/123/1/7.gif?puid=17fde5b578d-4a1000001084c61&gdpr=0&gdpr_consent= - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648703007024,
                "type": ""
            },
            {
                "level": "SEVERE",
                "message": "https://match.prod.bidr.io/cookie-sync/id5 - Failed to load resource: net::ERR_TOO_MANY_REDIRECTS",
                "timestamp": 1648703007024,
                "type": ""
            }
        ],
        "timestamp": 1648702994360,
        "duration": 17811
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 19784,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648703126866,
                "type": ""
            }
        ],
        "timestamp": 1648703124714,
        "duration": 20598
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 9528,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: unknown error: path is not absolute: ./allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: unknown error: path is not absolute: ./allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:23:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648703232137,
                "type": ""
            }
        ],
        "screenShotFile": "002d00a7-0023-004c-0013-002d002200c1.png",
        "timestamp": 1648703230240,
        "duration": 14997
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": false,
        "pending": false,
        "os": "Windows",
        "instanceId": 14776,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": [
            "Failed: unknown error: path is not absolute: allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)"
        ],
        "trace": [
            "WebDriverError: unknown error: path is not absolute: allure-results/demo.png\n  (Session info: chrome=100.0.4896.60)\n  (Driver info: chromedriver=99.0.4844.51 (d537ec02474b5afe23684e7963d538896c63ac77-refs/branch-heads/4844@{#875}),platform=Windows NT 10.0.19044 x86_64)\n    at Object.checkLegacyResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\error.js:546:15)\n    at parseHttpResponse (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:509:13)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\http.js:441:30\n    at processTicksAndRejections (node:internal/process/task_queues:96:5)\nFrom: Task: WebElement.sendKeys()\n    at Driver.schedule (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:807:17)\n    at WebElement.schedule_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2010:25)\n    at WebElement.sendKeys (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\webdriver.js:2174:19)\n    at actionFn (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:89:44)\n    at Array.map (<anonymous>)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:461:65\n    at ManagedPromise.invokeCallback_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:1376:14)\n    at TaskQueue.execute_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3084:14)\n    at TaskQueue.executeNext_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:3067:27)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2927:27Error\n    at ElementArrayFinder.applyAction_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:459:27)\n    at ElementArrayFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:91:29)\n    at ElementFinder.<computed> [as sendKeys] (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\built\\element.js:831:22)\n    at C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:23:19\n    at Generator.next (<anonymous>)\n    at fulfilled (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\JSFile\\DropDown.js:5:58)\nFrom: Task: Run it(\"Testing New Window\") in control flow\n    at UserContext.<anonymous> (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:94:19)\n    at attempt (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4297:26)\n    at QueueRunner.run (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4217:20)\n    at runNext (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4257:20)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4264:13\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4172:9\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasminewd2\\index.js:64:48\n    at ControlFlow.emit (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\events.js:62:21)\n    at ControlFlow.shutdown_ (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2674:10)\n    at C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\selenium-webdriver\\lib\\promise.js:2599:53\nFrom asynchronous test: \nError\n    at Suite.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:6:5)\n    at addSpecsToSuite (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1107:25)\n    at Env.describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:1074:7)\n    at describe (C:\\Users\\rohith\\AppData\\Roaming\\npm\\node_modules\\protractor\\node_modules\\jasmine-core\\lib\\jasmine-core\\jasmine.js:4399:18)\n    at Object.<anonymous> (C:\\Users\\rohith\\Documents\\JavaScripts\\ProtractorWithTypeScript\\DropDown.ts:5:1)\n    at Module._compile (node:internal/modules/cjs/loader:1103:14)\n    at Object.Module._extensions..js (node:internal/modules/cjs/loader:1157:10)\n    at Module.load (node:internal/modules/cjs/loader:981:32)\n    at Function.Module._load (node:internal/modules/cjs/loader:822:12)"
        ],
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648703326704,
                "type": ""
            }
        ],
        "screenShotFile": "00d1009d-0074-009c-00c1-007b00de007e.png",
        "timestamp": 1648703324458,
        "duration": 14465
    },
    {
        "description": "Testing New Window|Window Handles",
        "passed": true,
        "pending": false,
        "os": "Windows",
        "instanceId": 18256,
        "browser": {
            "name": "chrome",
            "version": "100.0.4896.60"
        },
        "message": "Passed",
        "browserLogs": [
            {
                "level": "WARNING",
                "message": "https://www.sendgb.com/src/plugins/ion-sound/ion.sound.js?v=6.1.5 9 The AudioContext was not allowed to start. It must be resumed (or created) after a user gesture on the page. https://goo.gl/7K7WLu",
                "timestamp": 1648703357866,
                "type": ""
            }
        ],
        "timestamp": 1648703356059,
        "duration": 20230
    }
];

    this.sortSpecs = function () {
        this.results = results.sort(function sortFunction(a, b) {
    if (a.sessionId < b.sessionId) return -1;else if (a.sessionId > b.sessionId) return 1;

    if (a.timestamp < b.timestamp) return -1;else if (a.timestamp > b.timestamp) return 1;

    return 0;
});

    };

    this.setTitle = function () {
        var title = $('.report-title').text();
        titleService.setTitle(title);
    };

    // is run after all test data has been prepared/loaded
    this.afterLoadingJobs = function () {
        this.sortSpecs();
        this.setTitle();
    };

    this.loadResultsViaAjax = function () {

        $http({
            url: './combined.json',
            method: 'GET'
        }).then(function (response) {
                var data = null;
                if (response && response.data) {
                    if (typeof response.data === 'object') {
                        data = response.data;
                    } else if (response.data[0] === '"') { //detect super escaped file (from circular json)
                        data = CircularJSON.parse(response.data); //the file is escaped in a weird way (with circular json)
                    } else {
                        data = JSON.parse(response.data);
                    }
                }
                if (data) {
                    results = data;
                    that.afterLoadingJobs();
                }
            },
            function (error) {
                console.error(error);
            });
    };


    if (clientDefaults.useAjax) {
        this.loadResultsViaAjax();
    } else {
        this.afterLoadingJobs();
    }

}]);

app.filter('bySearchSettings', function () {
    return function (items, searchSettings) {
        var filtered = [];
        if (!items) {
            return filtered; // to avoid crashing in where results might be empty
        }
        var prevItem = null;

        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            item.displaySpecName = false;

            var isHit = false; //is set to true if any of the search criteria matched
            countLogMessages(item); // modifies item contents

            var hasLog = searchSettings.withLog && item.browserLogs && item.browserLogs.length > 0;
            if (searchSettings.description === '' ||
                (item.description && item.description.toLowerCase().indexOf(searchSettings.description.toLowerCase()) > -1)) {

                if (searchSettings.passed && item.passed || hasLog) {
                    isHit = true;
                } else if (searchSettings.failed && !item.passed && !item.pending || hasLog) {
                    isHit = true;
                } else if (searchSettings.pending && item.pending || hasLog) {
                    isHit = true;
                }
            }
            if (isHit) {
                checkIfShouldDisplaySpecName(prevItem, item);

                filtered.push(item);
                prevItem = item;
            }
        }

        return filtered;
    };
});

//formats millseconds to h m s
app.filter('timeFormat', function () {
    return function (tr, fmt) {
        if(tr == null){
            return "NaN";
        }

        switch (fmt) {
            case 'h':
                var h = tr / 1000 / 60 / 60;
                return "".concat(h.toFixed(2)).concat("h");
            case 'm':
                var m = tr / 1000 / 60;
                return "".concat(m.toFixed(2)).concat("min");
            case 's' :
                var s = tr / 1000;
                return "".concat(s.toFixed(2)).concat("s");
            case 'hm':
            case 'h:m':
                var hmMt = tr / 1000 / 60;
                var hmHr = Math.trunc(hmMt / 60);
                var hmMr = hmMt - (hmHr * 60);
                if (fmt === 'h:m') {
                    return "".concat(hmHr).concat(":").concat(hmMr < 10 ? "0" : "").concat(Math.round(hmMr));
                }
                return "".concat(hmHr).concat("h ").concat(hmMr.toFixed(2)).concat("min");
            case 'hms':
            case 'h:m:s':
                var hmsS = tr / 1000;
                var hmsHr = Math.trunc(hmsS / 60 / 60);
                var hmsM = hmsS / 60;
                var hmsMr = Math.trunc(hmsM - hmsHr * 60);
                var hmsSo = hmsS - (hmsHr * 60 * 60) - (hmsMr*60);
                if (fmt === 'h:m:s') {
                    return "".concat(hmsHr).concat(":").concat(hmsMr < 10 ? "0" : "").concat(hmsMr).concat(":").concat(hmsSo < 10 ? "0" : "").concat(Math.round(hmsSo));
                }
                return "".concat(hmsHr).concat("h ").concat(hmsMr).concat("min ").concat(hmsSo.toFixed(2)).concat("s");
            case 'ms':
                var msS = tr / 1000;
                var msMr = Math.trunc(msS / 60);
                var msMs = msS - (msMr * 60);
                return "".concat(msMr).concat("min ").concat(msMs.toFixed(2)).concat("s");
        }

        return tr;
    };
});


function PbrStackModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;
    ctrl.convertTimestamp = convertTimestamp;
    ctrl.isValueAnArray = isValueAnArray;
    ctrl.toggleSmartStackTraceHighlight = function () {
        var inv = !ctrl.rootScope.showSmartStackTraceHighlight;
        ctrl.rootScope.showSmartStackTraceHighlight = inv;
    };
    ctrl.applySmartHighlight = function (line) {
        if ($rootScope.showSmartStackTraceHighlight) {
            if (line.indexOf('node_modules') > -1) {
                return 'greyout';
            }
            if (line.indexOf('  at ') === -1) {
                return '';
            }

            return 'highlight';
        }
        return '';
    };
}


app.component('pbrStackModal', {
    templateUrl: "pbr-stack-modal.html",
    bindings: {
        index: '=',
        data: '='
    },
    controller: PbrStackModalController
});

function PbrScreenshotModalController($scope, $rootScope) {
    var ctrl = this;
    ctrl.rootScope = $rootScope;
    ctrl.getParent = getParent;
    ctrl.getShortDescription = getShortDescription;

    /**
     * Updates which modal is selected.
     */
    this.updateSelectedModal = function (event, index) {
        var key = event.key; //try to use non-deprecated key first https://developer.mozilla.org/de/docs/Web/API/KeyboardEvent/keyCode
        if (key == null) {
            var keyMap = {
                37: 'ArrowLeft',
                39: 'ArrowRight'
            };
            key = keyMap[event.keyCode]; //fallback to keycode
        }
        if (key === "ArrowLeft" && this.hasPrevious) {
            this.showHideModal(index, this.previous);
        } else if (key === "ArrowRight" && this.hasNext) {
            this.showHideModal(index, this.next);
        }
    };

    /**
     * Hides the modal with the #oldIndex and shows the modal with the #newIndex.
     */
    this.showHideModal = function (oldIndex, newIndex) {
        const modalName = '#imageModal';
        $(modalName + oldIndex).modal("hide");
        $(modalName + newIndex).modal("show");
    };

}

app.component('pbrScreenshotModal', {
    templateUrl: "pbr-screenshot-modal.html",
    bindings: {
        index: '=',
        data: '=',
        next: '=',
        previous: '=',
        hasNext: '=',
        hasPrevious: '='
    },
    controller: PbrScreenshotModalController
});

app.factory('TitleService', ['$document', function ($document) {
    return {
        setTitle: function (title) {
            $document[0].title = title;
        }
    };
}]);


app.run(
    function ($rootScope, $templateCache) {
        //make sure this option is on by default
        $rootScope.showSmartStackTraceHighlight = true;
        
  $templateCache.put('pbr-screenshot-modal.html',
    '<div class="modal" id="imageModal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="imageModalLabel{{$ctrl.index}}" ng-keydown="$ctrl.updateSelectedModal($event,$ctrl.index)">\n' +
    '    <div class="modal-dialog modal-lg m-screenhot-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="imageModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="imageModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <img class="screenshotImage" ng-src="{{$ctrl.data.screenShotFile}}">\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <div class="pull-left">\n' +
    '                    <button ng-disabled="!$ctrl.hasPrevious" class="btn btn-default btn-previous" data-dismiss="modal"\n' +
    '                            data-toggle="modal" data-target="#imageModal{{$ctrl.previous}}">\n' +
    '                        Prev\n' +
    '                    </button>\n' +
    '                    <button ng-disabled="!$ctrl.hasNext" class="btn btn-default btn-next"\n' +
    '                            data-dismiss="modal" data-toggle="modal"\n' +
    '                            data-target="#imageModal{{$ctrl.next}}">\n' +
    '                        Next\n' +
    '                    </button>\n' +
    '                </div>\n' +
    '                <a class="btn btn-primary" href="{{$ctrl.data.screenShotFile}}" target="_blank">\n' +
    '                    Open Image in New Tab\n' +
    '                    <span class="glyphicon glyphicon-new-window" aria-hidden="true"></span>\n' +
    '                </a>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

  $templateCache.put('pbr-stack-modal.html',
    '<div class="modal" id="modal{{$ctrl.index}}" tabindex="-1" role="dialog"\n' +
    '     aria-labelledby="stackModalLabel{{$ctrl.index}}">\n' +
    '    <div class="modal-dialog modal-lg m-stack-modal" role="document">\n' +
    '        <div class="modal-content">\n' +
    '            <div class="modal-header">\n' +
    '                <button type="button" class="close" data-dismiss="modal" aria-label="Close">\n' +
    '                    <span aria-hidden="true">&times;</span>\n' +
    '                </button>\n' +
    '                <h6 class="modal-title" id="stackModalLabelP{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getParent($ctrl.data.description)}}</h6>\n' +
    '                <h5 class="modal-title" id="stackModalLabel{{$ctrl.index}}">\n' +
    '                    {{$ctrl.getShortDescription($ctrl.data.description)}}</h5>\n' +
    '            </div>\n' +
    '            <div class="modal-body">\n' +
    '                <div ng-if="$ctrl.data.trace.length > 0">\n' +
    '                    <div ng-if="$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer" ng-repeat="trace in $ctrl.data.trace track by $index"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                    <div ng-if="!$ctrl.isValueAnArray($ctrl.data.trace)">\n' +
    '                        <pre class="logContainer"><div ng-class="$ctrl.applySmartHighlight(line)" ng-repeat="line in $ctrl.data.trace.split(\'\\n\') track by $index">{{line}}</div></pre>\n' +
    '                    </div>\n' +
    '                </div>\n' +
    '                <div ng-if="$ctrl.data.browserLogs.length > 0">\n' +
    '                    <h5 class="modal-title">\n' +
    '                        Browser logs:\n' +
    '                    </h5>\n' +
    '                    <pre class="logContainer"><div class="browserLogItem"\n' +
    '                                                   ng-repeat="logError in $ctrl.data.browserLogs track by $index"><div><span class="label browserLogLabel label-default"\n' +
    '                                                                                                                             ng-class="{\'label-danger\': logError.level===\'SEVERE\', \'label-warning\': logError.level===\'WARNING\'}">{{logError.level}}</span><span class="label label-default">{{$ctrl.convertTimestamp(logError.timestamp)}}</span><div ng-repeat="messageLine in logError.message.split(\'\\\\n\') track by $index">{{ messageLine }}</div></div></div></pre>\n' +
    '                </div>\n' +
    '            </div>\n' +
    '            <div class="modal-footer">\n' +
    '                <button class="btn btn-default"\n' +
    '                        ng-class="{active: $ctrl.rootScope.showSmartStackTraceHighlight}"\n' +
    '                        ng-click="$ctrl.toggleSmartStackTraceHighlight()">\n' +
    '                    <span class="glyphicon glyphicon-education black"></span> Smart Stack Trace\n' +
    '                </button>\n' +
    '                <button type="button" class="btn btn-default" data-dismiss="modal">Close</button>\n' +
    '            </div>\n' +
    '        </div>\n' +
    '    </div>\n' +
    '</div>\n' +
     ''
  );

    });
