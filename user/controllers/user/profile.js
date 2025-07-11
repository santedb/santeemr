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

/// <reference path="../../.ref/js/santedb.js"/>
angular.module('santedb').controller('UserProfileController', ["$scope", "$rootScope", "$stateParams", "$timeout", function ($scope, $rootScope, $stateParams, $timeout) {

    // Initialize the view
    var initializeView = async function () {

        try {
            var sessionInfo = await SanteDB.authentication.getSessionInfoAsync();
            var userEntity = null;

            if (sessionInfo.entity && sessionInfo.entity.id)
                userEntity = await SanteDB.resources.userEntity.getAsync(sessionInfo.entity.id, "full");
            else {
                var userEntityQuery = await SanteDB.resources.userEntity.findAsync({ securityUser: sessionInfo.user.id });
                if (userEntityQuery.resource) {
                    userEntity = userEntityQuery.resource[0];
                }
                else {
                    userEntity = new UserEntity({
                        id: SanteDB.application.newGuid(),
                        securityUser: sessionInfo.user.id,
                        language: [
                            {
                                "languageCode": SanteDB.locale.getLanguage(),
                                "isPreferred": true
                            }
                        ]
                    });
                }
            }


            var userInfo = await SanteDB.resources.securityUser.getAsync(sessionInfo.user.id);
            userEntity._localOnly = sessionInfo.claims["urn:santedb:org:claim:local"] && sessionInfo.claims["urn:santedb:org:claim:local"][0] == "true";

            $timeout(() => {
                $scope.userEntity = userEntity;
                $scope.userEntity.securityUserModel = userInfo.entity;
                $scope.userEntity.securityUserModel.role = userInfo.role;
            });

        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView();
}]);

