/// <reference path="../.ref/js/santedb.js"/>
/// <reference path="../.ref/js/santedb-model.js"/>
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
var _boundTransitionStart = false;
// Start with nav collapsed
$("body").addClass("sidenav-toggled");
angular.module('santedb').controller('EmrLayoutController', ["$scope", "$rootScope", "$state", "$templateCache", "$interval", "$transitions", "$timeout", function ($scope, $rootScope, $state, $templateCache, $interval, $transitions, $timeout) {

    var _lastTickle = null;
    var _isTickling = false;
    // Load helper properties
    async function loadHelperProperties() {
        if ($rootScope.refValues) { return; }
        try {
            $rootScope.refValues = {};
            var templates = await SanteDB.application.getTemplateDefinitionsAsync();
            var familialRelationships = await SanteDB.resources.conceptSet.invokeOperationAsync(null, "expand", { "_mnemonic": "FamilyMember" });
            var myFacilityId = await SanteDB.authentication.getCurrentFacilityId();
            var myFacility = myFacilityId == EmptyGuid ? null : await SanteDB.resources.place.getAsync(myFacilityId, "min");
            
            $timeout(() => {
                $rootScope.refValues.FamilyMember = familialRelationships.resource?.map(o => o.mnemonic);
                $rootScope.refValues.templates = templates;
                $rootScope.refValues.facilityName = SanteDB.display.renderEntityName(myFacility?.name);
                $rootScope.refValues.facility = myFacility;
            });
        }
        catch (e) {
            console.warn("Could not load reference values");
        }
    }

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
//            toastr.warning(SanteDB.locale.getString("ui.emr.mailError"));
            console.error(e);
        }
    };

    // Check for new tickles
    async function checkTickles() {
        try {
            if (_isTickling) return; // already checking tickles - don't want to duplicate
            _isTickling = true;
            var sourceTickles = await SanteDB.resources.tickle.findAsync({});
            var tickles = [], toasted = [];
            sourceTickles.forEach(function (t) {

                if (!t.type) return;

                if ((t.type.indexOf && t.type.indexOf("Toast") > -1 || t.type & 4) && toasted.indexOf(t.text) == -1) {

                    toasted.push(t.text);

                    if (t.type.indexOf && t.type.indexOf("Danger") > -1 || t.type & 2)
                        toastr.error(t.text, null, { preventDuplicates: true });
                    else
                        toastr.info(t.text, null, { preventDuplicates: true });
                    SanteDB.resources.tickle.deleteAsync(t.id);
                }
                else {
                    tickles.push(t);
                }
            });

            var lastTickle = tickles.length > 0 ? tickles[tickles.length - 1].id : null;
            if (!lastTickle) {
                _lastTickle = null;
            }
            else if (lastTickle != _lastTickle) {
                _lastTickle = lastTickle;
                toastr.info(SanteDB.locale.getString("ui.emr.alerts.new"), null, { preventDuplicates: true });
            }

            $timeout(() => $scope.tickles = tickles);
        }
        catch (e) {
            toastr.warning(SanteDB.locale.getString("ui.emr.tickleError"));
            console.error(e);
        }
        finally {
            _isTickling = false;
        }
    }

    // Check for conflict status
    async function checkConflicts() {
        if ($rootScope.system && $rootScope.system.config && $rootScope.system.config.integration && $rootScope.system.config.integration.mode == 'synchronize') {
            try {
                var queue = await SanteDB.resources.queue.findAsync();
                $timeout(() => $scope.queue = queue);
            }
            catch (e) {
                toastr.warning(SanteDB.locale.getString("ui.emr.queueError"));
                console.error(e);
            }
        }
    }

    // Load menus for the current user
    async function loadMenus() {
        try {
            var menus = await SanteDB.application.getMenusAsync("ui.emr");
            $timeout(() => {
                $scope.menuItems = menus;
                $timeout(() => setNavRail(), 500);
            });
        }
        catch (e) {
            toastr.warning(SanteDB.locale.getString("ui.admin.menuError"));
            console.error(e);
        }
    }

    /// Sets the navigation rail to peek
    function setNavRail() {

        var railTimer = null;
        var railLogicFn = function (event) {
            if ($("body").hasClass("sidenav-toggled")) {
                var navItem = $(".navbar-sidenav");
                $("body").removeClass("sidenav-toggled");
                navItem.addClass("navbar-peek");
                $("*", navItem).addClass("navbar-peek");

                if (event.type == "mouseover") {
                    $(window).bind("mousemove", function (e) {
                        var target = $(e.target);
                        if (!target.hasClass("navbar-peek")) {
                            $(".navbar-peek").removeClass("navbar-peek");
                            $("body").addClass("sidenav-toggled");
                            $(window).unbind("mousemove");
                        }
                    });
                }

            }
        }


        $(".navbar-sidenav").on('mouseover', function (e) {
            if (!window.isTouchDevice()) {
                railLogicFn(e);
            }
        });

        $(".navbar-sidenav").on("swipe", function (e, d) {
            //console.info(d, e);
            if (d.swipeRight) {
                railLogicFn(e);
            } else if(d.swipeLeft && $(e.target).hasClass("navbar-peek")) {
                $(".navbar-peek").removeClass("navbar-peek");
                $("body").addClass("sidenav-toggled");
            }
        })
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

    // abandon session
    $scope.abandonSession = async function () {
        try {
            await SanteDB.authentication.logoutAsync();
            $("#logoutModal").modal('hide');
            $timeout(() => {
                $rootScope.session = null;
                $templateCache.removeAll();
                //$state.go('login');
            });

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    // Watch the session and load menus accordingly (in case user elevates)
    $rootScope.$watch('session', function (nv, ov) {
        if (nv && nv.user && (!ov || nv.username != ov?.username)) {
            // Add menu items
            loadMenus();
            loadHelperProperties();
            checkTickles();
            checkConflicts();
            checkMail();
        }
        else if (ov && (!nv || !nv.user)) {
            $scope.menuItems = null;
            $rootScope.refValues = null;
            $state.go("login");
        }
    });

    if ($rootScope.session) {
        loadMenus();
        loadHelperProperties();
    }

    // Clear all tickles
    $scope.clearTickles = async function () {
        if ($scope.tickles) {

            await Promise.all($scope.tickles.map(async function (t) {
                try {
                    await SanteDB.resources.tickle.deleteAsync(t.id);
                    checkTickles();
                }
                catch (e) {
                    toastr.warning(SanteDB.locale.getString("ui.emr.tickleError"));
                }
            }));

        }
    }

    checkMail();
    checkTickles();
    checkConflicts();

    // Mailbox
    var refreshInterval = $interval(function () {
        if ($rootScope.session) {
            checkTickles();
            checkConflicts();
        }
    }, 60000);

    var mailInterval = $interval(checkMail, 600000);

    $scope.$on('$destroy', function () {
        if (refreshInterval) {
            $interval.cancel(refreshInterval);
        }
        if (mailInterval) {
            $interval.cancel(mailInterval);
        }
    });


    // Confirm navigation away in AngularJS route
    if (!_boundTransitionStart) {
        $transitions.onStart({ exiting: ["santedb-emr.patient.register", "santedb-emr.patient.register-batch"] }, function (transition) {
            var scope = angular.element("#editForm").scope();
            if (!scope.editForm.$pristine && !scope.editForm.$submitted && (scope.entity && !scope.entity.id || scope.act && !scope.act.id)) return confirm(SanteDB.locale.getString("ui.emr.navigateConfirmation"));
            return true;
        });
        _boundTransitionStart = true;
    }

    // Set the view handlers
    SanteDB.application.addResourceViewer("AuditData", function (state, parms) { (state || $state).transitionTo("santedb-emr.system.audit.view", parms); return true; });
    SanteDB.application.addResourceViewer("PatientEncounter", function (state, parms) { (state || $state).transitionTo("santedb-emr.encounter.view", parms); return true; });
    SanteDB.application.addResourceViewer("Patient", function (state, parms) { (state || $state).transitionTo("santedb-emr.patient.view", parms); return true; });
    SanteDB.application.addResourceViewer("DiagnosticReport", function (state, parms) {
        (state || $state).transitionTo("santedb-emr.system.bug");
        return true;
    });

    // Is there no route? We should show the dashboard
    $rootScope.$watch("system.config", function (n, o) {
        if (n) {
            if (n._isConfigured === false) {
                $state.go("santedb-config.initial");
            }
            else if ($state.$current == "santedb-emr") {
                $state.go("santedb-emr.dashboard");
            }
        }
    });

    $scope.dropElevatedSession = async function() {
        try {
            SanteDB.display.buttonWait("#btnEndElevation", true);
            var session = SanteDB.authentication.getElevator()?.getSession();
            if(session?.id_token) {
                await SanteDB.authentication.logoutAsync(session.id_token);
            }
        }
        finally {
            SanteDB.authentication.setElevator(null);
            SanteDB.display.buttonWait("#btnEndElevation", false);
            $state.go("santedb-emr.dashboard");

        }
    }

}]);

