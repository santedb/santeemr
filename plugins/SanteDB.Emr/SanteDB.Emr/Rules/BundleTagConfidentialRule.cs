using SanteDB;
using SanteDB.Core.Model.Acts;
using SanteDB.Core.Model.Collection;
using SanteDB.Core.Model.Constants;
using SanteDB.Core.Model.Entities;
using SanteDB.Core.Security;
using SanteDB.Core.Security.Privacy;
using SanteDB.Core.Security.Services;
using SanteDB.Core.Services;
using SanteDB.Rest.HDSI.Vrp;
using SanteEMR.Configuration;
using System;
using System.Collections.Generic;
using System.Linq;

namespace SanteEMR.Rules
{
    /// <summary>
    /// Tag sensitive information as confidential
    /// </summary>
    public class BundleTagConfidentialRule : BaseBusinessRulesService<Bundle>
    {
        private readonly EmrConfigurationSection m_configuration;
        private readonly IConceptRepositoryService m_conceptRepository;
        private readonly IPolicyInformationService m_pipService;
        private readonly IPolicy m_vipPolicy;


        /// <summary>
        /// DI constructor
        /// </summary>
        public BundleTagConfidentialRule(IConceptRepositoryService conceptRepository, IConfigurationManager configurationManager, IPolicyInformationService pipService)
        {
            this.m_configuration = configurationManager.GetSection<EmrConfigurationSection>();
            this.m_conceptRepository = conceptRepository;
            this.m_pipService = pipService;
            if (!String.IsNullOrEmpty(this.m_configuration?.AutoApplyVipPolicy))
            {
                this.m_vipPolicy = pipService.GetPolicy(this.m_configuration.AutoApplyVipPolicy);
            }

        }

        /// <summary>
        /// Tags any sensitive information in the payload with the indicated confidential policy tag
        /// </summary>
        public override Bundle BeforeInsert(Bundle data)
        {
            if (data == null)
            {
                throw new ArgumentNullException(nameof(data));
            }

            var policyMaps = this.m_configuration?.AutoApplyPolicyMap.SelectMany(o => this.m_conceptRepository.ExpandConceptSet(o.ConceptSet).ToArray().Select(c => new { Concept = c.Key.Value, Policy = o.PolicyOid }))
                .GroupBy(o => o.Concept)
                .ToDictionaryIgnoringDuplicates(o => o.Key, o => o.Select(c => this.m_pipService.GetPolicy(c.Policy)).ToArray());

            // Process VIPs in the bundle
            if (this.m_vipPolicy != null)
            {
                foreach (var ent in data.Item.OfType<Person>().Where(o =>
                    o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Ignore &&
                    o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Delete &&
                    (o.VipStatusKey.HasValue ||
                    o.LoadProperty(
                        r => r.Relationships, referenceData: data.Item).Where(r => r.RelationshipTypeKey == EntityRelationshipTypeKeys.Mother).Any(r => (r.LoadProperty(t => t.TargetEntity, referenceData: data.Item) as Person)?.VipStatusKey != null)
                    )
                ))
                {
                    var entPolicies = ent.LoadProperty(o => o.Policies);
                    if (!entPolicies.Any(p => p.PolicyKey == this.m_vipPolicy.Key))
                    {
                        entPolicies.Add(new SanteDB.Core.Model.Security.SecurityPolicyInstance()
                        {
                            PolicyKey = this.m_vipPolicy.Key,
                            GrantType = SanteDB.Core.Model.Security.PolicyGrantType.Grant
                        });
                    }
                }
            }

            // Process each act in the bundle 
            foreach (var act in data.Item.OfType<Act>().Where(o =>
                o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Ignore &&
                o.BatchOperation != SanteDB.Core.Model.DataTypes.BatchOperationType.Delete &&
                o.MoodConceptKey == ActMoodKeys.Eventoccurrence
                ).ToArray()
            )
            {
                act.Policies = act.Policies ?? new List<SanteDB.Core.Model.Security.SecurityPolicyInstance>(); // preserve user policies

                // Apply policies
                if (act.StatusConceptKey == StatusKeys.Completed && policyMaps?.TryGetValue(act.TypeConceptKey.GetValueOrDefault(), out var appliedPolicyMaps) == true)
                {
                    act.Policies.AddRange(appliedPolicyMaps.Where(p => !act.Policies.Any(ap => ap.PolicyKey == p.Key)).Select(o => new SanteDB.Core.Model.Security.SecurityPolicyInstance()
                    {
                        PolicyKey = o.Key,
                        GrantType = SanteDB.Core.Model.Security.PolicyGrantType.Grant
                    }));
                }

                // Hide / Tag Confidential for VIPs
                var rct = act.LoadProperty(o => o.Participations, referenceData: data.Item).FirstOrDefault(o => o.ParticipationRoleKey == ActParticipationKeys.RecordTarget)?.LoadProperty(o => o.PlayerEntity, referenceData: data.Item) as Person;
                if (rct?.VipStatusKey != null && this.m_vipPolicy != null && !act.Policies.Any(p => p.PolicyKey == this.m_vipPolicy.Key))
                {
                    act.Policies.Add(new SanteDB.Core.Model.Security.SecurityPolicyInstance()
                    {
                        PolicyKey = this.m_vipPolicy.Key,
                        GrantType = SanteDB.Core.Model.Security.PolicyGrantType.Grant
                    });
                }

                // If there are any consent directives on the patient we want to apply them to this record as well
                var rctPolicies = rct?.LoadProperty(o => o.Policies).Where(p => !act.Policies.Any(a => a.PolicyKey == p.PolicyKey));
                if(rctPolicies?.Any() == true)
                {
                    act.Policies.AddRange(rctPolicies.Select(o => new SanteDB.Core.Model.Security.SecurityPolicyInstance()
                    {
                        PolicyKey = o.PolicyKey,
                        GrantType = o.GrantType
                    }));
                }
            }


            data.Item.ForEach(i => i.AddAnnotation(new PreventPrivacyWriteValidation()));
            return base.BeforeInsert(data);
        }


    }
}
