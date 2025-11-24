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
// app/routes/auth.login/route.jsx
// app/routes/_index/route.jsx
import { redirect } from "@remix-run/node";

/**
 * Root of the Render app (`/`).
 * Shopify doesn't need this, but if something hits `/`
 * (like a HEAD check) we just redirect to /auth/login.
 */
export const loader = async () => {
  return redirect("/auth/login");
};

// If Remix ever posts here, treat it the same.
export const action = loader;

export default function Index() {
  // This never actually renders because we always redirect.
  return null;
}