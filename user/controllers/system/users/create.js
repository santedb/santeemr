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
angular.module('santedb').controller("EmrCreateUserController", ["$scope", "$rootScope", "$state", "$timeout", function ($scope, $rootScope, $state, $timeout) {

    async function initializeView() {
        var dsdl = await SanteDB.authentication.getCurrentFacilityId();
        var target = {
            entity: new SecurityUser(),
            userEntity: new UserEntity({
                language: [
                    {
                        "languageCode": SanteDB.locale.getLanguage(),
                        "isPreferred": true
                    }
                ],
                name: {
                    OfficialRecord: new EntityName({
                        useModel: new Concept({
                            id: NameUseKeys.OfficialRecord,
                            mnemonic: "OfficialRecord"
                        }),
                        component: {
                            Prefix: [],
                            Given: [],
                            Family: [],
                            Suffix: []
                        }
                    })
                },
                relationship: {
                    DedicatedServiceDeliveryLocation: [
                        {
                            target: dsdl
                        }
                    ],
                    MaintainedEntity: [

                    ]
                }
            }),
            preferredLanguage: SanteDB.locale.getLanguage(),
            role: ["LOCAL_USERS", "CLINICAL_STAFF"]
        };
        $timeout(() => $scope.target = target);
    }

    initializeView();


    /** Watch for changes in the password and calculate strength  */
    $scope.$watch("target.entity.password", function (n, o) {
        if (n && $scope.target)
            $scope.strength = SanteDB.application.calculatePasswordStrength(n);
    });

    /** Watch for changes in admin state  */
    $scope.$watch("target.isAdmin", function (n, o) {

        if ($scope.target) {
            $scope.target.role = n ? ["LOCAL_ADMINISTRATORS", "LOCAL_USERS", "CLINICAL_STAFF"] :
                ["LOCAL_USERS", "CLINICAL_STAFF"];
        }
    });

    /** Watch for changes to the username if we're creating and warn of duplicates */
    $scope.$watch("target.entity.userName", async function (n, o) {
        if (n != o && n && n.length >= 3) {
            try {
                var userMatch = await SanteDB.resources.securityUser.findAsync({ userName: n, _count: 0 });

                $timeout(() => {
                    if (userMatch.size > 0 && !$scope.target.entity.id)
                        $scope.userForm.username.$setValidity('duplicate', false);
                    else
                        $scope.userForm.username.$setValidity('duplicate', true);
                });
            }
            catch (e) {

            }
        }
    });

    /** Save the user or create them */
    $scope.saveUser = async function (userForm) {
        if (!userForm.$valid) return;

        try {

            // First, copy telecoms over to the user entity
            $scope.target.userEntity.telecom = $scope.target.userEntity.telecom || {};
            $scope.target.userEntity.telecom.MobileContact = [];
            $scope.target.userEntity.telecom.WorkPlace = [];
            if ($scope.target.entity.phoneNumber)
                $scope.target.userEntity.telecom.MobileContact.push({ value: `tel://${$scope.target.entity.phoneNumber}` });
            if ($scope.target.entity.email)
                $scope.target.userEntity.telecom.WorkPlace.push({ value: `mailto:${$scope.target.entity.email}` });


            // Set preferred language
            delete ($scope.target.userEntity.language);
            $scope.target.userEntity.language = {
                "isPreferred": true,
                "languageCode": $scope.target.preferredLanguage
            };

            // Show wait state
            SanteDB.display.buttonWait("#saveUserButton", true);

            var userInfo = {
                $type: "SecurityUserInfo",
                role: $scope.target.role,
                entity: $scope.target.entity,
                expirePassword: $scope.target.expirePassword
            };

            userInfo = await SanteDB.resources.securityUser.insertAsync(userInfo);
            $scope.target.userEntity.securityUser = userInfo.id;
            userEntity = await SanteDB.resources.userEntity.insertAsync($scope.target.userEntity);
            toastr.success(SanteDB.locale.getString("ui.model.securityUser.saveSuccess"));
            $state.transitionTo("santedb-emr.system.users.index");
        }
        catch (e) {
            if (e.$type == "DetectedIssueException") { // Error with password?
                $timeout(() => {
                    userForm.newPassword.$error = {};
                    var passwdRules = e.rules.filter(function (d) { return d.priority == "Error" && d.id == "password.complexity"; });
                    if (passwdRules.length == e.rules.length) {
                        passwdRules.forEach(function (d) {
                            userForm.newPassword.$error[d.id] = true;
                        });
                    }
                    else
                        $rootScope.errorHandler(e);
                });
            }
            else
                $rootScope.errorHandler(e);

        }
        finally {
            SanteDB.display.buttonWait("#saveUserButton", false);
        }
    }
}]);