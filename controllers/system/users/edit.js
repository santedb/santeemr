angular.module('santedb').controller("EmrEditUserController", ["$scope", "$rootScope", "$stateParams", "$state", "$timeout", function ($scope, $rootScope, $stateParams, $state, $timeout) {

    /** Select a user for editing */
    async function initializeView (id) {

        try {
            var target = null;
            if (!id) {
                target = {
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
                                    id:  NameUseKeys.OfficialRecord,
                                    mnemonic: "OfficialRecord"
                                }),
                                component: {
                                    Given: ""
                                }
                            })
                        }
                    }),
                    preferredLanguage: SanteDB.locale.getLanguage(),
                    role: ["LOCAL_USERS", "CLINICAL_STAFF"]
                };
            }
            else {
                target = await SanteDB.resources.securityUser.getAsync(id);
                target.isAdmin = $scope.target.role.indexOf("LOCAL_ADMINISTRATORS") > -1;
                var userMatch = await SanteDB.resources.userEntity.findAsync({ securityUser: id, _viewModel: "full" });
                if (!userMatch.resource)
                    target.userEntity = new UserEntity({
                        language: [
                            {
                                "languageCode": SanteDB.locale.getLanguage(),
                                "isPreferred": true
                            }
                        ],
                        securityUser: id
                    });
                else
                    target.userEntity = userMatch.resource[0];

                // Set language
                if (!target.userEntity.language)
                    target.preferredLanguage = SanteDB.locale.getLanguage();
                else if (!Array.isArray($scope.target.userEntity.language))
                    target.preferredLanguage = $scope.target.userEntity.language.languageCode;
                else {
                    var lng = target.userEntity.language.find(function (l) { return l.isPreferred; });
                    if (!lng)
                        lng = { "languageCode": SanteDB.locale.getLanguage() };
                    target.preferredLanguage = lng.languageCode;
                }

            }

            $timeout(() => $scope.target = target);
            $("#userModal").modal();
        }
        catch (e) {
            $rootScope.errorHandler(e);
        }
    }

    initializeView($stateParams.id);

   
    /** Watch for changes in the password and calculate strength  */
    $scope.$watch("target.entity.password", function (n, o) {
        if (n)
            $scope.strength = SanteDB.application.calculatePasswordStrength(n);
    });

    /** Watch for changes in admin state  */
    $scope.$watch("target.isAdmin", function (n, o) {

        if (n)
            $scope.target.role = ["LOCAL_ADMINISTRATORS", "LOCAL_USERS", "CLINICAL_STAFF"];
        else
            $scope.target.role = ["LOCAL_USERS", "CLINICAL_STAFF"];
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

            // Correct arrays and assign id
            if (!$scope.target.userEntity.id) {
                $scope.target.userEntity.id = SanteDB.application.newGuid();
            }

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
                entity: $scope.target.entity
            };

            if($stateParams.id)
                userInfo = await SanteDB.resources.securityUser.updateAsync($stateParams.id, userInfo);
            else
                userInfo = await SanteDB.resources.securityUser.insertAsync(userInfo);

            $scope.target.userEntity.securityUser = userInfo.entity.id;
            if($scope.target.userEntity.id)
                userEntity = await SanteDB.resources.userEntity.updateAsync($scope.target.userEntity.id, $scope.target.userEntity);
            else 
                userEntity = await SanteDB.resources.userEntity.insertAsync($scope.target.userEntity);
            toastr.success(SanteDB.locale.getString("ui.model.securityUser.saveSuccess"));

            $state.transitionTo("santedb-emr.system.users.index");
        }
        catch (e) {
            if (e.$type == "DetectedIssueException" && userForm.newPassword) { // Error with password?
                userForm.newPassword.$error = {};
                var passwdRules = e.rules.filter(function (d) { return d.priority == "Error" && d.text == "err.password.complexity"; });
                if (passwdRules.length == e.rules.length) {
                    passwdRules.forEach(function (d) {
                        userForm.newPassword.$error[d.text] = true;
                    });
                    $scope.$apply();
                }
                else
                    $rootScope.errorHandler(e);
            }
            else
                $rootScope.errorHandler(e);

        }
        finally {
            SanteDB.display.buttonWait("#saveUserButton", false);

        }
    }
}]);