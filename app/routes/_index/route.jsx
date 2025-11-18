// import { redirect } from "@remix-run/node";
// import { Form, useLoaderData } from "@remix-run/react";
// import { login } from "../../shopify.server";
// import styles from "./styles.module.css";

// export const loader = async ({ request }) => {
//   const url = new URL(request.url);

//   if (url.searchParams.get("shop")) {
//     throw redirect(`/app?${url.searchParams.toString()}`);
//   }

//   return { showForm: Boolean(login) };
// };

// export default function App() {
//   const { showForm } = useLoaderData();

//   return (
//     <div className={styles.index}>
//       <div className={styles.content}>
//         <h1 className={styles.heading}>A short heading about [your app]</h1>
//         <p className={styles.text}>
//           A tagline about [your app] that describes your value proposition.
//         </p>
//         {showForm && (
//           <Form className={styles.form} method="post" action="/auth/login">
//             <label className={styles.label}>
//               <span>Shop domain</span>
//               <input className={styles.input} type="text" name="shop" />
//               <span>e.g: my-shop-domain.myshopify.com</span>
//             </label>
//             <button className={styles.button} type="submit">
//               Log in
//             </button>
//           </Form>
//         )}
//         <ul className={styles.list}>
//           <li>
//             <strong>Product feature</strong>. Some detail about your feature and
//             its benefit to your customer.
//           </li>
//           <li>
//             <strong>Product feature</strong>. Some detail about your feature and
//             its benefit to your customer.
//           </li>
//           <li>
//             <strong>Product feature</strong>. Some detail about your feature and
//             its benefit to your customer.
//           </li>
//         </ul>
//       </div>
//     </div>
//   );
// }
// app/routes/_index/route.jsx
// app/routes/_index.jsx
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

export const loader = async () => {
  // simple health/info response
  return json({
    status: "ok",
    app: "Bliss Vapes Stock Check",
    message: "Backend is running. Open this app from your Shopify Admin.",
  });
};

export default function RootInfoPage() {
  const data = useLoaderData();

  return (
    <html>
      <head>
        <title>{data.app}</title>
      </head>
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <h1>{data.app}</h1>
        <p>{data.message}</p>
        <p>
          Dev URL: <code>https://cfms-dev.myshopify.com/admin/apps</code>
        </p>
        <p>
          Once there, click <strong>“Bliss vapes stock check”</strong> to launch the
          embedded app.
        </p>
      </body>
    </html>
  );
}