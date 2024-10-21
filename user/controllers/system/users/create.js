angular.module('santedb').controller("EmrCreateUserController", ["$scope", "$rootScope", "$state", "$timeout", function ($scope, $rootScope, $state, $timeout) {

    $scope.target = {
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
            }
        }),
        preferredLanguage: SanteDB.locale.getLanguage(),
        role: ["LOCAL_USERS", "CLINICAL_STAFF"]
    };


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