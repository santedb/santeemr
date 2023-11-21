/// <reference path="../.ref/js/santedb.js"/>
/// <reference path="../.ref/js/santedb-model.js"/>
/*
 * Portions Copyright 2015-2019 Mohawk College of Applied Arts and Technology
 * Portions Copyright 2019-2019 SanteSuite Contributors (See NOTICE)
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
 * User: Justin Fyfe
 * Date: 2019-8-8
 */
var _boundTransitionStart = false;
angular.module('santedb').controller('EmrLayoutController', ["$scope", "$rootScope", "$state", "$templateCache", "$interval", "$transitions", "$timeout", function ($scope, $rootScope, $state, $templateCache, $interval, $transitions, $timeout) {

    // Check for new mail
    async function checkMail() {

        try {
            var mailMessages = await SanteDB.resources.mail.findAssociatedAsync("Inbox", "Message", { flags: 0 });
            await Promise.all(mailMessages.resource.map(async function (mb) {
                mb.targetModel = await SanteDB.resources.mail.getAssociatedAsync("Inbox", "Message", mb.target);
            }));
            $timeout(() => $scope.mailbox = mailMessages.resource);
        }
        catch (e) {
            toastr.warning(SanteDB.locale.getString("ui.admin.mailError"));
            console.error(e);
        }
    };

    // Check for new tickles
    async function checkTickles() {
        try {
            var tickles = await SanteDB.resources.tickle.findAsync({});
            var hasAlert = false;
            tickles.forEach(function (t) {

                if (!t.type) return;

                if (t.type.indexOf && t.type.indexOf("Danger") > -1 || t.type & 2)
                    hasAlert = true;

                if (t.type.indexOf && t.type.indexOf("Toast") > -1 || t.type & 4) {
                    if (t.type.indexOf && t.type.indexOf("Danger") > -1 || t.type & 2)
                        toastr.error(t.text, null, { preventDuplicates: true });
                    else
                        toastr.info(t.text, null, { preventDuplicates: true });

                    SanteDB.resources.tickle.deleteAsync(t.id);
                }
            });
            $timeout(() => $scope.tickles = tickles);
        }
        catch (e) {
            toastr.warning(SanteDB.locale.getString("ui.admin.tickleError"));
            console.error(e);
        }
    }

    // Check for conflict status
    async function checkConflicts() {
        if ($rootScope.system && $rootScope.system.config && $rootScope.system.config.sync && $rootScope.system.config.sync.mode == 'Sync') {
            try {
                await SanteDB.resources.queue.findAsync();
                $timeout(() => $scope.queue = queue);
            }
            catch (e) {
                toastr.warning(SanteDB.locale.getString("ui.admin.queueError"));
                console.error(e);
            }
        }
    }

    // Load menus for the current user
    async function loadMenus() {
        try {
            var menus = await SanteDB.application.getMenusAsync("ui.emr");
            $timeout(() => $scope.menuItems = menus);
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeSideNavTriggers();

    // Shows the elevation dialog, elevates and then refreshes the state
    $scope.overrideRefresh = function () {
        new SanteDBElevator(
            function () {
                $templateCache.removeAll();
                $state.reload();
            }
        ).elevate($rootScope.session);
    }

    // On logout transition to the login state
    $("#logoutModal").on("hidden.bs.modal", function () {
        if (!window.sessionStorage.getItem("token")) {
            $templateCache.removeAll();
            $state.transitionTo('login');
        }
    });

    // abandon session
    $scope.abandonSession = async function () {
        try {
            await SanteDB.authentication.logoutAsync();
            $("#logoutModal").modal('hide');
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Watch the session and load menus accordingly (in case user elevates)
    $rootScope.$watch('session', function (nv, ov) {
        if (nv && nv.user) {
            // Add menu items
            loadMenus();
        }
        else
            $scope.menuItems = null;
    });

    if ($rootScope.session) {
        loadMenus();
    }

    // Clear all tickles
    $scope.clearTickles = async function () {
        if ($scope.tickles) {

            await Promise.all($scope.tickles.map(async function (t) {
                try {
                    await SanteDB.resources.tickle.deleteAsync(t.id);
                }
                catch (e) {
                    toastr.warning(SanteDB.locale.getString("ui.admin.tickleError"));
                }
            }));

        }
    }

    checkMail();
    checkTickles();
    checkConflicts();

    // Mailbox
    var refreshInterval = $interval(function () {
        checkTickles();
        checkConflicts();
    }, 60000);

    var mailInterval = $interval(checkMail, 600000);

    $scope.$on('$destroy', function () {
        if (refreshInterval) {
            $interval.cancel(refreshInterval);
        }
        if(mailInterval) {
            $interval.cancel(mailInterval);
        }
    });


    // Confirm navigation away in AngularJS route
    if (!_boundTransitionStart) {
        $transitions.onStart({ exiting: ["santedb-emr.patient.register", "santedb-emr.patient.register-batch"] }, function (transition) {
            var scope = angular.element("#editForm").scope();
            if (!scope.editForm.$pristine && (scope.entity && !scope.entity.id || scope.act && !scope.act.id)) return confirm(SanteDB.locale.getString("ui.emr.navigateConfirmation"));
            return true;
        });
        _boundTransitionStart = true;
    }

    // Set the view handlers
    SanteDB.application.addResourceViewer("Patient", function (parms) { $state.transitionTo("santedb-emr.patient.view", parms); return true; });
    SanteDB.application.addResourceViewer("DiagnosticReport", function (parms) {
        $state.transitionTo("santedb-emr.system.bug");
        return true;
    });
    
    // Is there no route? We should show the dashboard
    $rootScope.$watch("system.config", function(n, o) {
        if(n) {
            if(n._isConfigured === false) {
                $state.go("santedb-config.initial");
            }
            else if ($state.$current == "santedb-emr") {
                $state.go("santedb-emr.dashboard");
            }
        }
    });

}]);

