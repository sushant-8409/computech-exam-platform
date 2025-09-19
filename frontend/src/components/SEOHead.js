import React from 'react';
import { Helmet } from 'react-helmet-async';

const SEOHead = ({ 
  title = "AucTutor - Online Education Platform",
  description = "Advanced online education platform for students and educators with coding practice, secure exams, AI assistance, and detailed analytics.",
  keywords = "education, online learning, coding practice, exam platform, student portal, AucTutor, programming, AI tutor",
  url = "https://auctutor.app",
  image = "https://auctutor.app/og-image.png",
  type = "website",
  author = "AucTutor Team"
}) => {
  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      <meta name="author" content={author} />
      <meta name="robots" content="index, follow" />
      <meta name="language" content="English" />
      <meta name="revisit-after" content="7 days" />
      
      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:site_name" content="AucTutor" />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter */}
      <meta property="twitter:card" content="summary_large_image" />
      <meta property="twitter:url" content={url} />
      <meta property="twitter:title" content={title} />
      <meta property="twitter:description" content={description} />
      <meta property="twitter:image" content={image} />
      <meta property="twitter:site" content="@AucTutor" />
      
      {/* Additional SEO */}
      <meta name="theme-color" content="#8b5cf6" />
      <meta name="application-name" content="AucTutor" />
      <meta name="apple-mobile-web-app-title" content="AucTutor" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="mobile-web-app-capable" content="yes" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "EducationalOrganization",
          "name": "AucTutor",
          "description": description,
          "url": url,
          "logo": "https://auctutor.app/logo.png",
          "sameAs": [
            "https://twitter.com/AucTutor",
            "https://linkedin.com/company/auctutor"
          ],
          "contactPoint": {
            "@type": "ContactPoint",
            "contactType": "Customer Service",
            "email": "support@auctutor.app"
          },
          "educationalCredentialAwarded": "Certificate",
          "hasCredential": {
            "@type": "EducationalOccupationalCredential",
            "name": "Programming Proficiency Certificate"
          }
        })}
      </script>
    </Helmet>
  );
};

export default SEOHead;