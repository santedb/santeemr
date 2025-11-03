using Newtonsoft.Json;
using SanteDB.Core.Configuration;
using System;
using System.Collections.Generic;
using System.Text;
using System.Xml.Serialization;

namespace SanteEMR.Configuration
{
    /// <summary>
    /// Configuration section for the EMR
    /// </summary>
    [XmlType(nameof(EmrConfigurationSection), Namespace = "http://santedb.org/configuration/santeemr")]
    public class EmrConfigurationSection : IConfigurationSection
    {

        /// <summary>
        /// Auto apply a policy mapping
        /// </summary>
        [XmlArray("policyMapping"), XmlArrayItem("set"), JsonProperty("policyMapping")]
        public List<EmrPolicyMappingConfiguration> AutoApplyPolicyMap { get; set; }
    }

    /// <summary>
    /// A single mapping
    /// </summary>
    [XmlType(nameof(EmrPolicyMappingConfiguration), Namespace = "http://santedb.org/configuration/santeemr")]
    public class EmrPolicyMappingConfiguration
    {
        /// <summary>
        /// Gets or set the concept set for the mapping
        /// </summary>
        [XmlAttribute("conceptSet"), JsonProperty("conceptSet")]
        public Guid ConceptSet { get; set; }

        /// <summary>
        /// Gets or sets the policy oid to apply
        /// </summary>
        [XmlAttribute("policy"), JsonProperty("policy")]
        public String PolicyOid { get; set; }
    }
}
