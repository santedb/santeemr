/// <reference path="../../.ref/js/santedb.js"/>
/// <reference path="../../.ref/js/santedb-model.js"/>
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
 * Date: 2019-9-27
 */
angular.module('santedb').controller('EmrPatientSearchController', ["$scope", "$rootScope", "$state", "$timeout", "$stateParams", function ($scope, $rootScope, $state, $timeout, $stateParams) {
    // Initial view
    $scope.search = {
        value: null, 
        upstream: false
    };
    if($state.q) {
        $scope.search.value = q;
        $scope.search.upstream = $state.o;
        performSearch($scope.search);
    }

    // Perform the search and populate the results
    function performSearch(search, upstream) {
        $scope.filter = {
            _any : search.value, 
            _upstream : upstream,
            _viewModel : 'full',
            _orderBy: 'modifiedOn:desc'
        };
    }

    $scope.search = function(searchForm) {
        if(searchForm.$invalid) return;
        performSearch($scope.search);
    }

    $scope.searchOnline = function() {
        performSearch($scope.search, upstream);
    }
}])
// Advanced Search
// Search - By Demographics
.controller('EmrAdvancedPatientSearchController', [ "$scope", "$rootScope", "$state", "$timeout", "$stateParams", function($scope, $rootScope, $state, $timeout, $stateParams) {

    // Initial view
    $scope.search = {
        upstream: false
    };

    function countFilterCriteria() {
        var nParameters = 0;

        if($scope.search['name.component[Given].value'] && $scope.search['name.component[Family].value']) // Name is one search field
            nParameters++;
        if($scope.search['address.component[City].value']) 
            nParameters++;
        if($scope.search['genderConcept']) 
            nParameters++;
        if($scope.search['dateOfBirth'])
            nParameters++;
        if($scope.search['identifier.value']) 
            nParameters += 5; // Identifier is a known good search criteria
        if($scope.search['telecom[PrimaryHome|MobileContact].value'] || $scope.search['telecom[WorkPlace].value'])
            nParameters++;
        if($scope.search['relationship[type.conceptSet.mnemonic=FamilyMember].target.name.component[Given].value'] && $scope.search['relationship[~FamilyMember].target.name.component[Family].value']) 
            nParameters++;
        if($scope.search['relationship[type.conceptSet.mnemonic=FamilyMember].target.telecom[PrimaryHome|MobileContact].value'] || $scope.search['relationship[~FamilyMember].target.telecom[WorkPlace].value'])
            nParameters++;
        if($scope.search['relationship[type.conceptSet.mnemonic=FamilyMember].target.identifier.value']) 
            nParameters += 5;

        $scope.searchForm.$setValidity('insufficient', nParameters >= 3);

    }

    function performSearch(searchCrtiteria) {
        $scope.filter = {
            _viewModel: 'full',
            _orderBy: 'modifiedOn:desc',
            _upstream: searchCrtiteria.upstream
        };

        // Are we search
    }

    $scope.search = function(searchForm) {
        if(searchForm.$invalid) {
            return;
        }

        performSearch($scope.search);
    }
}]);