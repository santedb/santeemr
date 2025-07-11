/// <reference path="../../.ref/js/santedb.js"/>
/*
 * Copyright (C) 2021 - 2025, SanteSuite Inc. and the SanteSuite Contributors (See NOTICE.md for full copyright notices)
 * Portions Copyright (C) 2019 - 2021, Fyfe Software Inc. and the SanteSuite Contributors
 * Portions Copyright (C) 2015-2018 Mohawk College of Applied Arts and Technology
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you
 * may not use this file except in compliance with the License. You may
 * obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations under
 * the License.
 *
 */
angular.module('santedb').controller('ConfigurationController', ['$scope', '$rootScope', '$interval', '$timeout', function ($scope, $rootScope, $interval, $timeout) {

    // Reference data
    $scope.reference = {
        place: [],
        facility: [],
        identityDomain: [],
        subscriptions: []
    };
    $scope.permittedSubscriptions = [];
    $scope.newItem = {};
    $scope.serverCaps = {};
    $scope.widgets = {};
    // Get the widgets for the config panel
    SanteDB.application.getWidgetsAsync("org.santedb.config", "Tab").then(function (d) {
        $scope.widgets = d;
    }).catch(function (e) { console.error(e); });

    // Add other setting
    $scope.addOtherSetting = function (newItem) {
        if (!newItem.key)
            newItem.keyMissingError = true;
        else {
            delete (newItem.keyMissingError);
            $scope.config.application.setting.push(angular.copy(newItem));
            newItem.key = "";
            newItem.value = "";
        }
    }

    function canSelectSubscription(subscription, referenceObjects) {
        return SanteDB.configuration.canSelectSubscription(subscription, referenceObjects, $scope.config.sync.mode);
    }

    // Process configuration
    async function _processConfiguration(config, sessionInfo) {

        try {
            // Get subscription reference
            let subscriptions = await SanteDB.resources.subscriptionDefinition.findAsync({ _upstream: true });
            let appSolutions = await SanteDB.application.getAppSolutionsAsync();
            let appInfo = await SanteDB.application.getAppInfoAsync();
            let dataProviders = await SanteDB.configuration.getDataProvidersAsync();
            let integrationPatterns = await SanteDB.configuration.getIntegrationPatternsAsync();
            let certificates = await SanteDB.resources.certificates.findAsync({ hasPrivateKey: true });

            config.sync._resource = {};
            config.sync.subscribeTo = config.sync.subscribeTo || [];

            $timeout(_ => {
                subscriptions.resource.forEach((itm) => {
                    $scope.reference.subscriptions.push(itm);
                    config.sync._resource[itm.id] = { selected: true };
                });

                $scope.reference.solutions = appSolutions;
                $scope.reference.certificates = certificates;
                $scope.serverCaps = appInfo;
                $scope.reference.integrationPatterns = integrationPatterns;
                $scope.reference.dataProviders = dataProviders;
                $scope.reference.providerData = {};
                $scope.security = config.security;
                $scope.security.owner = $scope.security.owner || [ sessionInfo.entity.id ];
                $scope.reference.dataProviders.forEach(p => $scope.reference.providerData[p.invariant] = p.options);
            });
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }

        return config;
    }

    // Get configuration from the server
    async function _getConfiguration(sessionInfo) {
        try {

            let config = await SanteDB.configuration.getAsync();
            let sessionInfoExt = sessionInfo || angular.copy(await SanteDB.authentication.getSessionInfoAsync());

            config = await _processConfiguration(config, sessionInfoExt);

            $timeout(() => $scope.config = config);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Select all guard conditions
    $scope.setSubscriptionSelection = async function (value) {
        $scope.reference.subscriptions.forEach(function (s) {
            if (value &&
                canSelectSubscription(s)) {
                $scope.config.sync._resource[s.uuid] = $scope.config.sync._resource[s.uuid] || {};
                $scope.config.sync._resource[s.uuid].selected = value;
            }
            else {
                $scope.config.sync._resource[s.uuid] = $scope.config.sync._resource[s.uuid] || {};
                $scope.config.sync._resource[s.uuid].selected = false;
            }
        });
    }

    $scope.propogateNetworkChanges = function (n, o) {
        $scope.config.client.clients.forEach(c => {
            c.optimize = $scope.config.client.optimize;
            c.clientCertificate = $scope.config.client.clientCertificate;
        });
    }

    $scope.propogateDataChanges = function (n, o) {
        Object.keys($scope.config.data.connections).forEach(k => {
            let c = $scope.config.data.connections[k];
            c.provider = $scope.config.data.provider;
            c.options = angular.copy($scope.config.data.options);
        });
    }

    // Save configuration settings
    $scope.save = async function (form) {

        try {
            SanteDB.display.buttonWait("#finishButton", true);

            // Get and coy the configuration values
            let config = angular.copy(await SanteDB.configuration.getAsync());
            config.values = {};
            Object.keys(config).filter(o => !o.startsWith("_") && o !== "values" && o !== "realm").forEach(c => {
                config.values[c] = $scope.config[c];
                delete config[c];
            });
            config.$type = "Configuration";
            // Find the resource definition 
            config.values.sync.subscription = Object.keys(config.values.sync._resource).filter((i) => i !== "undefined" && config.values.sync._resource[i].selected)
                .map(k => $scope.reference.subscriptions.find(p => p.id == k))
                .filter(i => i != null)
                .map(k => k.id);

            // Define the services
            config.values.application.service = $scope.serverCaps.appInfo.service.filter(function (s) { return s.active; })
                .map(function (m) { return { type: m.type } });
            config._autoRestart = true;

            try {
                
                config = await SanteDB.configuration.saveAsync(config);

                SanteDB.display.buttonWait("#finishButton", false);

                if (config._autoRestart) {
                    $timeout(_ => {
                        $scope.restartTimer = 20;
                        $("#countdownModal").modal({
                            backdrop: 'static'
                        });
                        let iv = $interval(() => {
                            if ($scope.restartTimer-- < 3) {
                                window.location.hash = '';
                                window.location.reload();
                            }
                        }, 1000);
                    });
                }
                else {
                    SanteDB.application.close();
                    $("#completeModal").modal({
                        backdrop: 'static'
                    });
                }
            }
            catch (e) {
                SanteDB.display.buttonWait("#finishButton", false);
                $rootScope.errorHandler(e);
            }
        }
        catch (e) {
            SanteDB.display.buttonWait("#finishButton", false);
            $rootScope.errorHandler(e);
        }
    }
    
    // Get necessary information
    SanteDB.authentication.setElevator(new SanteDBElevator(_getConfiguration, false));
    _getConfiguration();

    $scope.$watch("config.sync.subscribeType", function (n, o) {
        if (n) {
            $scope.config.sync.subscribeTo = $scope.config.sync.subscribeTo || [];
            // $scope.config.sync.subscribeTo.splice(0, $scope.config.sync.subscribeTo.length);
            $scope.permittedSubscriptions.splice(0, $scope.permittedSubscriptions.length);
        }
    });

    // Watch scope and refresh list of subscriptions
    $scope.$watch('config.sync.subscribeTo.length', function (n, o) {
        // Find in new
        if (n) {
            $scope.permittedSubscriptions.splice(0, $scope.permittedSubscriptions.length);
            $scope.config.sync.subscribeTo.forEach(async function (sid) {
                let referenceObjects = $scope.reference[$scope.config.sync.subscribeType.toCamelCase()];
                let existingInfo = referenceObjects.find(function (p) { return p.id === sid });

                // Don't have any info on this object - Look it up
                if (!existingInfo) {
                    SanteDB.display.buttonWait("#selectAllButton", true);
                    $("#nextButton").prop("disabled", true);
                    try {
                        existingInfo = await SanteDB.resources[$scope.config.sync.subscribeType.toCamelCase()].getAsync(sid, "dropdown");
                        $timeout(() => {
                            $scope.reference[$scope.config.sync.subscribeType.toCamelCase()].push(existingInfo);
                        });
                        referenceObjects.push(existingInfo);
                    }
                    catch (e) {
                        console.error(e);
                    }
                    finally {
                        SanteDB.display.buttonWait("#selectAllButton", false);
                        $("#nextButton").prop("disabled", false);
                    }
                }
                let subscriptions = $scope.reference.subscriptions.filter((s) => canSelectSubscription(s, referenceObjects, $scope.config.sync.mode));
                $timeout(() => {
                    $scope.permittedSubscriptions = subscriptions;
                });
            });
        }
    });
}]);